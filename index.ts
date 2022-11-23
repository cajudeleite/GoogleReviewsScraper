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

    if (res) console.log("In cookie");
    else console.log("Not in cookie");

    const buttonSelector = "button";
    await page.waitForSelector(buttonSelector);
    console.log("Found button");

    const [response] = await Promise.all([
      page.waitForNavigation(), // The promise resolves after navigation has finished
      page.click(buttonSelector), // Clicking the link will indirectly cause a navigation
    ]);

    console.log(response);

    const resp = await checkIfInCookiePage(page);

    if (resp) console.log("In cookie");
    else console.log("Not in cookie");

    // Wait for the results page to load and display the results.
    const resultsSelector = ".hfpxzc";
    await page.waitForSelector(resultsSelector);

    console.log("Found results");

    // Extract the results from the page.
    const titles = await page.evaluate((resultsSelector) => {
      return [...document.querySelectorAll(resultsSelector)].map((anchor) => anchor.ariaLabel);
    }, resultsSelector);

    // Print all the files.
    console.log(titles.join("\n"));

    await browser.close();
  } catch (error) {
    console.error(error);
  }
};

getReviews("french restaurants in paris");
