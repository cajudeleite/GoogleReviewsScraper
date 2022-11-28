import puppeteer from "puppeteer";
import cliProgress from "cli-progress";
import fs from "fs";

const bar = new cliProgress.SingleBar({}, cliProgress.Presets.legacy);

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const deleteResultsFile = () =>
  fs.unlink("./results.json", (error) => {
    null;
  });

const writeResultsInFile = (results: {
  results: {
    place: string | null;
    reviews:
      | {
          stars: number;
          text: string;
        }[]
      | null;
  }[];
}) => {
  const jsonResults = JSON.stringify(results);

  fs.writeFile("results.json", jsonResults, (error) => {
    null;
  });
};

const initPuppeteer = async (searchQuery: string) => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    if (!searchQuery) {
      await browser.close();
      throw new Error("Prompt is empty");
    }

    await page.goto(`https://www.google.com/maps/search/${searchQuery.replace(" ", "+")}`);

    console.log("Went to the page");
    return { browser, page };
  } catch (error) {
    throw error;
  }
};

const passCookiePage = async (page: puppeteer.Page) => {
  try {
    const buttonSelector = "button";
    await page.waitForSelector(buttonSelector);

    await Promise.all([
      page.waitForNavigation(), // The promise resolves after navigation has finished
      page.click(buttonSelector), // Clicking the link will indirectly cause a navigation
    ]);
  } catch (error) {
    throw error;
  }
};

const checkIfInCookiePage = async (page: puppeteer.Page) => {
  try {
    const titleSelector = "h1";
    await page.waitForSelector(titleSelector);
    const title = await page.evaluate((titleSelector) => document.querySelector(titleSelector)?.textContent, titleSelector);
    return title === "Avant d'accéder à Google";
  } catch (error) {
    throw error;
  }
};

const getElementHeightAndScroll = async (page: puppeteer.Page, selector: string) => {
  try {
    const elementHeight = await page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Couldn't find element with selector ${selector}`);

      const elementHeight = parseInt(JSON.stringify(JSON.parse(element.scrollHeight.toString())));

      element.scroll(0, elementHeight);

      return elementHeight;
    }, selector);

    return elementHeight;
  } catch (error) {
    throw error;
  }
};

const scrollToTheBottomOfContainer = async (page: puppeteer.Page, containerSelector: string) => {
  try {
    await page.waitForSelector(containerSelector);

    let firstHeight = await getElementHeightAndScroll(page, containerSelector);
    await delay(3000);
    let secondHeight = await getElementHeightAndScroll(page, containerSelector);

    while (firstHeight < secondHeight) {
      await delay(3000);

      firstHeight = secondHeight;
      secondHeight = await getElementHeightAndScroll(page, containerSelector);
    }
  } catch (error) {
    throw error;
  }
};

const getPlacesNameAndUrl = async (page: puppeteer.Page) => {
  try {
    const feedSelector = ".DxyBCb";
    await page.waitForSelector(feedSelector);

    // Get the feed container
    const feedIndex = await page.evaluate(
      (feedSelector) => [...document.querySelectorAll(feedSelector)].findIndex((anchor) => anchor.ariaLabel?.includes("Résultats")),
      feedSelector
    );

    const realFeedSelector = `${feedSelector}:nth-child(${feedIndex})`;

    // Scroll to the bottom of places feed
    console.clear();
    console.log("Fetching all the places corresponding to the given prompt. This can take a while...");
    await scrollToTheBottomOfContainer(page, realFeedSelector);

    // Wait for the results page to load and display the results.
    const resultsSelector = ".hfpxzc";
    await page.waitForSelector(resultsSelector);

    // Extract the urls from the places
    const places = await page.evaluate((resultsSelector) => {
      const placeList: { name: string; url: string }[] = [];
      [...document.querySelectorAll(resultsSelector)].forEach((anchor) => {
        if (anchor.ariaLabel)
          placeList.push({
            name: anchor.ariaLabel,
            url: (anchor as HTMLLinkElement).href,
          });
      });
      return placeList;
    }, resultsSelector);

    return places;
  } catch (error) {
    throw error;
  }
};

const showAllReviews = async (page: puppeteer.Page) => {
  try {
    const moreReviewsButtonSelector = ".M77dve";
    await page.waitForSelector(moreReviewsButtonSelector);

    // Find more reviews button
    await page.evaluate((moreReviewsButtonSelector) => {
      [...document.querySelectorAll(moreReviewsButtonSelector)].forEach((anchor) => {
        if (anchor.ariaLabel?.includes("Plus d'avis")) (anchor as HTMLButtonElement).click();
      });
    }, moreReviewsButtonSelector);
  } catch (error) {
    throw error;
  }
};

const getPlaceReviews = async (place: { name: string; url: string }, page: puppeteer.Page) => {
  console.log(`  Fetching ${place.name}`);

  try {
    // Go to place's Google Maps page
    await Promise.all([
      page.waitForNavigation(), // The promise resolves after navigation has finished
      page.goto(place.url),
    ]);

    // Show all the place's reviews
    await showAllReviews(page);

    const reviewsContainerSelector = ".dS8AEf";

    await scrollToTheBottomOfContainer(page, reviewsContainerSelector);

    const reviewsSelector = ".jJc9Ad";
    await page.waitForSelector(reviewsSelector);

    // Get reviews from place
    const reviews = await page.evaluate((reviewsSelector) => {
      const reviewsList: { stars: number; text: string }[] = [];
      [...document.querySelectorAll(reviewsSelector)].forEach((anchor) => {
        // Get content div
        const contentSelector = ".GHT2ce";
        const content = anchor.querySelectorAll(contentSelector)[1];

        // Get stars
        const starsSelector = ".kvMYJc";
        const starsRes = content.querySelector(starsSelector)?.ariaLabel;
        const stars = starsRes ? parseInt(starsRes[1]) : null;

        // Get expand button and click it if it exists
        const moreButtonSelector = ".w8nwRe";
        const moreButton: HTMLButtonElement | null = content.querySelector(moreButtonSelector);
        if (moreButton) moreButton.click();

        // Get review text
        const textSelector = ".wiI7pd";
        const text = content.querySelector(textSelector)?.textContent;

        if (stars && stars < 3 && text && text !== "") reviewsList.push({ stars: stars, text: text });
      });

      return reviewsList;
    }, reviewsSelector);

    return { place: place.name, reviews };
  } catch (error) {
    return { place: place.name, reviews: null };
  }
};

const getPlacesReviews = async (places: { name: string; url: string }[], page: puppeteer.Page) => {
  const reviewsByPlace: { place: string; reviews: { stars: number; text: string }[] }[] = [];

  console.clear();
  console.log(`${places.length} total places`);

  try {
    bar.start(places.length, 0);
    for (let i = 0; i < places.length; i++) {
      const placeReviews = await getPlaceReviews(places[i], page);
      bar.update(i + 1);

      if (placeReviews.reviews) reviewsByPlace.push(placeReviews);
    }
    bar.stop();

    return reviewsByPlace;
  } catch (error) {
    throw error;
  }
};

const getReviews = async (searchQuery: string) => {
  try {
    // Delete results.json file if it exists already
    if (fs.existsSync("./results.json")) deleteResultsFile();

    // Init puppeteer and go to Google Maps page
    const { browser, page } = await initPuppeteer(searchQuery);

    // Check if scraper is in cookie page
    const cookies = await checkIfInCookiePage(page);

    // If scraper is in cookie page, pass it
    if (cookies) await passCookiePage(page);

    const stillCookies = await checkIfInCookiePage(page);

    if (stillCookies) throw new Error("Didn't pass the cookie page");
    else console.log("Passed the cookie page");

    // Get the places name and url
    const places = await getPlacesNameAndUrl(page);

    // Get reviews from the places
    const reviewsByPlace = await getPlacesReviews(places, page);

    const results = {
      results: reviewsByPlace,
    };

    // Write results in results.json
    writeResultsInFile(results);

    // Close scraper
    await browser.close();

    console.clear();
    console.log("Done");
  } catch (error) {
    console.error(error);
  }
};

// Get prompt from the terminal when executing the script
const getParamsFromTerminal = () => {
  const argvArray = [];
  for (let i = 0; i < process.argv.length - 2; i++) {
    argvArray.push(process.argv[i + 2]);
  }
  return argvArray.join(" ");
};

getReviews(getParamsFromTerminal());
