import puppeteer from "puppeteer";

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

const getReviews = async (searchQuery: string) => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(`https://www.google.com/maps/search/${searchQuery.replace(" ", "+")}`);

    console.log("Went to the page");

    const res = await checkIfInCookiePage(page);

    if (!res) throw new Error("Didn't start at cookie page");

    const buttonSelector = "button";
    await page.waitForSelector(buttonSelector);

    await Promise.all([
      page.waitForNavigation(), // The promise resolves after navigation has finished
      page.click(buttonSelector), // Clicking the link will indirectly cause a navigation
    ]);

    const resp = await checkIfInCookiePage(page);

    if (resp) throw new Error("Didn't pass the cookie page");
    else console.log("Passed the cookie page");

    // Wait for the results page to load and display the results.
    const resultsSelector = ".hfpxzc";
    await page.waitForSelector(resultsSelector);

    // Extract the urls from the restaurants
    const restaurants = await page.evaluate((resultsSelector) => {
      return [...document.querySelectorAll(resultsSelector)].map((anchor) => ({
        name: anchor.ariaLabel,
        url: (anchor as HTMLLinkElement).href,
      }));
    }, resultsSelector);

    for (let i = 0; i < restaurants.length; i++) {
      const restaurant = restaurants[i];

      console.log(`Fetching ${restaurant.name}`);

      await Promise.all([
        page.waitForNavigation(), // The promise resolves after navigation has finished
        page.goto(restaurant.url),
      ]);

      const moreReviewsButtonSelector = ".M77dve";
      await page.waitForSelector(moreReviewsButtonSelector);

      // Find more reviews button
      await page.evaluate((moreReviewsButtonSelector) => {
        [...document.querySelectorAll(moreReviewsButtonSelector)].forEach((anchor) => {
          if (anchor.ariaLabel?.includes("Plus d'avis")) (anchor as HTMLButtonElement).click();
        });
      }, moreReviewsButtonSelector);

      // await Promise.all([
      //   page.waitForNavigation(), // The promise resolves after navigation has finished
      // ]);

      const rating = ".fontDisplayLarge";
      await page.waitForSelector(rating);
      const rate = await page.evaluate((rating) => document.querySelector(rating)?.textContent, rating);
      console.log(rate);
    }

    // Print all the files.
    // console.log(urls.join("\n"));

    await browser.close();
  } catch (error) {
    console.error(error);
  }
};

getReviews("french restaurants in paris");
