import puppeteer from "puppeteer";

export async function browseWebPage(url) {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	await page.goto(url);
	const content = await page.content();
	await browser.close();
	return content;
}

export function findPhoneNumbersAndEmails(text) {
	// Regular expression to match phone numbers (US format)
	let phoneNumbers = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g);

	// Regular expression to match email addresses
	let emails = text.match(
		/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
	);

	return {
		phoneNumbers: phoneNumbers,
		emails: emails,
	};
}
