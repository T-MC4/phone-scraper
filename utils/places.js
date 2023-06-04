// Import required dependencies
import axios from "axios";
import fs from "fs";
import stringSimilarity from "string-similarity";
import { config } from "dotenv";
config();

// Get Google Places API key from environment variables
const KEY = process.env.GOOGLE_PLACES_API_KEY;

// Endpoints
const endpoints = {
	find: "https://maps.googleapis.com/maps/api/place/findplacefromtext/json",
	details: "https://maps.googleapis.com/maps/api/place/details/json",
};

// Custom HTTP error class for adding status code to error messages
class HttpError extends Error {
	constructor(message, status) {
		super(message);
		this.status = status;
	}
}

// This function finds company details
export async function findCompanyDetails(company, address, history) {
	try {
		// Request to Google Places API
		const _res = await axios.get(endpoints.find, {
			params: {
				input: `${company} ${address}`,
				inputtype: "textquery",
				key: KEY,
			},
		});

		// If request is denied, throw an error with status code 400
		if (_res.data.status === "REQUEST_DENIED")
			throw new HttpError(_res.data.error_message || "Error", 400);

		// If no results found, push company to history and throw an error with status code 400
		if (
			_res.data.status === "ZERO_RESULTS" ||
			_res.data.candidates.length === 0
		) {
			history.cache.push({ company, date: Date.now() });
			history.save();
			throw new HttpError("Company not found", 400);
		}

		// Get place_id of first candidate
		const place_id = _res.data.candidates[0].place_id;

		// Check if place is in history
		const placeHistory = history.cache.find((a) => a.place_id == place_id);

		// If place is in history, return phone number if it exists, else throw error
		if (placeHistory) {
			if (!placeHistory.international_phone_number)
				throw new HttpError("No phone number", 400);
			return {
				international_phone_number: placeHistory.international_phone_number,
			};
		}

		// Request for place details
		const __res = await axios.get(endpoints.details, {
			params: {
				place_id,
				fields: "international_phone_number,name",
				language: "fr",
				key: KEY,
			},
		});

		// Get name of place and convert to lowercase
		let name = __res.data.result?.name?.toLowerCase();

		// Remove parentheses from the company name
		let simComp = company;
		if (simComp.includes("(") && simComp.includes(")")) {
			simComp = simComp.replace(/ *\([^)]*\)*/g, "");
		}

		// Check if company name and place name are similar
		if (
			name &&
			(stringSimilarity.compareTwoStrings(simComp, name) >= 0.6 ||
				name.startsWith(simComp) ||
				name.endsWith(simComp) ||
				name.includes(" " + simComp + " "))
		) {
			// If similar, get phone number
			const international_phone_number =
				__res.data.result?.international_phone_number;
			// Add place to history
			history.cache.push({
				company,
				place_id,
				international_phone_number,
				date: Date.now(),
			});
			history.save();

			// If no phone number, throw error with status code 400
			if (!international_phone_number)
				throw new HttpError("No phone number", 400);

			// If phone number exists, return phone number
			return { international_phone_number };
		} else {
			// If not similar, add place to history without phone number
			history.cache.push({
				company,
				place_id,
				date: Date.now(),
			});
			history.save();

			// Throw error with status code 400
			throw new HttpError("Company not found", 400);
		}
	} catch (err) {
		// Handle exceptions by logging the error and throwing an HttpError
		console.log("places function Catch Error: ", err);
		// console.error(err?.response || err);
		console.log("err.reponse.status: ", err?.response?.data);
		console.log("err.reponse.status: ", err?.response?.status);
		throw new HttpError(err?.response?.data || "Error: Catch Error - ", 400);
	}
}

// Function to create new credentials
export const createCredentials = (permissions, credentials) => {
	const token = generateToken();

	// Add the new credentials to the cache and save
	credentials.cache.push({
		token_type: "Token",
		token,
		permissions,
		requests: [],
		date: Date.now(),
	});
	credentials.save();
};

// Function to generate a token
const generateToken = () => {
	const length = 40;
	let result = "";
	const characters =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	const charactersLength = characters.length;
	const point = Math.floor(Math.random() * (length - 5) + 5);

	// Generate a random alphanumeric string, with a dot every random number of characters
	for (let i = 0; i < length; i++) {
		if (i % point == 0 && i !== 0) result += ".";
		else
			result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}

	return result;
};

// Class for managing JSON databases
export class JsonDatabase {
	constructor(_path) {
		this.path = _path;

		// Create the file if it does not exist
		if (!fs.existsSync(_path)) fs.writeFileSync(_path, "[]");

		// Load the JSON data into the cache
		this.cache = JSON.parse(fs.readFileSync(_path));

		// Save the current cache size
		this.bcachel = JSON.stringify(this.cache).length;

		// Initialize other variables
		this.lastSave = 0;
		this.isSaving = false;
	}

	// Method to save the cache to the file
	save() {
		// Do not save if already saving or cache size has not changed
		if (this.isSaving || this.bcachel === JSON.stringify(this.cache).length)
			return;

		this.isSaving = true;

		// If more than a second has passed since the last save, save immediately
		if (Date.now() - this.lastSave > 1000) {
			fs.writeFile(this.path, JSON.stringify(this.cache, null, 4), {}, () => {
				this.isSaving = false;
				this.lastSave = Date.now();
				this.bcachel = JSON.stringify(this.cache).length;
			});
		} else {
			// Otherwise, delay the save to maintain a 1-second minimum interval
			setTimeout(() => {
				fs.writeFile(this.path, JSON.stringify(this.cache, null, 4), {}, () => {
					this.isSaving = false;
					this.lastSave = Date.now();
					this.bcachel = JSON.stringify(this.cache).length;
				});
			}, 1000 - (Date.now() - this.lastSave));
		}
	}
}
