const mongoose = require("mongoose");
const data = require("./data.js");
const Listing = require('../models/listing');
const initData = require('./data');

const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";

main()
  .then(() => {
    console.log("Connected to DB");
    initDB(); // move this inside the main() promise after successful DB connection
  })
  .catch((err) => {
    console.log("hi");
    console.error(err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

const initDB = async () => {
  await Listing.deleteMany({});

  // Use new to instantiate ObjectId
  initData.data = initData.data.map((obj) => ({
    ...obj,
    owner:("680cfc4c66ad7ab3a7695dda"), // Use new here
  }));

  await Listing.insertMany(initData.data);
  console.log("Data was initialized");
};

initDB();
