import puppeteer from "puppeteer";
import fs from "fs";

const deleteResultsFile = () =>
  fs.unlink("./results.json", (error) => {
    null;
  });

const writeResultsInFile = (results: {
  results: {
    place: string | null;
    reviews: {
      stars: string;
      text: string;
    }[];
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

const getPlacesNameAndUrl = async (page: puppeteer.Page) => {
  try {
    // Wait for the results page to load and display the results.
    const resultsSelector = ".hfpxzc";
    await page.waitForSelector(resultsSelector);

    // Extract the urls from the places
    const places = await page.evaluate((resultsSelector) => {
      return [...document.querySelectorAll(resultsSelector)].map((anchor) => ({
        name: anchor.ariaLabel,
        url: (anchor as HTMLLinkElement).href,
      }));
    }, resultsSelector);

    return places;
  } catch (error) {
    throw error;
  }
};

const getPlacesReviews = async (places: { name: string | null; url: string }[], page: puppeteer.Page) => {
  const reviewsByPlace: { place: string | null; reviews: { stars: string; text: string }[] }[] = [];

  try {
    for (let i = 0; i < places.length; i++) {
      const placeReviews = await getPlaceReview(places[i], page);
      reviewsByPlace.push(placeReviews);
    }

    return reviewsByPlace;
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

const getPlaceReview = async (place: { name: string | null; url: string }, page: puppeteer.Page) => {
  console.log(`Fetching ${place.name}`);

  try {
    // Go to place's Google Maps page
    await Promise.all([
      page.waitForNavigation(), // The promise resolves after navigation has finished
      page.goto(place.url),
    ]);

    // Show all the place's reviews
    await showAllReviews(page);

    const reviewsSelector = ".jJc9Ad";
    await page.waitForSelector(reviewsSelector);

    // Get reviews from place
    const reviews = await page.evaluate((reviewsSelector) => {
      return [...document.querySelectorAll(reviewsSelector)].map((anchor) => {
        // Get content div
        const contentSelector = ".GHT2ce";
        const content = anchor.querySelectorAll(contentSelector)[1];

        // Get stars
        const starsSelector = ".kvMYJc";
        const stars = content.querySelector(starsSelector)?.ariaLabel;

        // Get expand button and click it if it exists
        const moreButtonSelector = ".w8nwRe";
        const moreButton: HTMLButtonElement | null = content.querySelector(moreButtonSelector);
        if (moreButton) moreButton.click();

        // Get review text
        const textSelector = ".wiI7pd";
        const text = content.querySelector(textSelector)?.textContent;

        return { stars: stars || "0", text: text || "" };
      });
    }, reviewsSelector);

    return { place: place.name, reviews };
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

    // Save the results in results.json
    const results = {
      results: reviewsByPlace,
    };

    // Write results in results.json
    writeResultsInFile(results);

    // Close scraper
    await browser.close();

    console.log("Done");
  } catch (error) {
    console.error(error);
  }
};

const getParamsFromTerminal = () => {
  const argvArray = [];
  for (let i = 0; i < process.argv.length - 2; i++) {
    argvArray.push(process.argv[i + 2]);
  }
  return argvArray.join(" ");
};

getReviews(getParamsFromTerminal());
