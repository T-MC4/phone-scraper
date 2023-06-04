import express from "express";
import getURLs from "./utils/metaphor.js";
import cors from "cors";
import { browseWebPage, findPhoneNumbersAndEmails } from "./utils/scraping.js";

// Initialize Express app
const app = express();

// Use CORS middleware to allow all origins
app.use(cors({ origin: "*" }));

// Define endpoint for GET /search (pass user request, get back phone numbers)
app.get("/search", async (req, res) => {
	const query = req.query.query;

	if (!query) {
		return res.status(400).json({ error: "Missing query parameter" });
	}

	const urls = await getURLs(query);
	console.log(urls);
	const data = [];

	for (let url of urls) {
		const text = await browseWebPage(url);
		const { phoneNumbers, emails } = findPhoneNumbersAndEmails(text);
		console.log(phoneNumbers);

		data.push({
			url: url,
			text: text,
			phoneNumbers: phoneNumbers,
			emails: emails,
		});

		console.log(data);
	}

	return res.json(data);
});

// Listen to port 3000
app.listen(3000, () => console.log("Server running on http://localhost:3000"));
