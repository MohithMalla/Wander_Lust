// This is a script you would run separately, not within your regular route handling

const mongoose = require("mongoose");
const Listing = require("./models/listing");
const User = require("./models/user");

const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust"; // Your database URL

async function updateNullOwners() {
    try {
        await mongoose.connect(MONGO_URL);
        console.log("Connected to DB for update script");

        const mohithUser = await User.findOne({ username: "mohith" });

        if (mohithUser) {
            const updatedListings = await Listing.updateMany(
                { owner: null },
                { $set: { owner: mohithUser._id } }
            );
            console.log(`Updated ${updatedListings.modifiedCount} listings with owner: ${mohithUser.username}`);
        } else {
            console.log("User 'mohith' not found.");
        }

        mongoose.disconnect();
        console.log("Disconnected from DB");
    } catch (err) {
        console.error("Error during update:", err);
    }
}

updateNullOwners();