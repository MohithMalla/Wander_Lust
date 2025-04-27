if(process.env.NODE_ENV != "production"){
require("dotenv").config();}
// console.log(process.env.SECRET);

// ---------- Importing Modules ----------
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require('express-session');
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const multer = require("multer");
const MongoStore=require("connect-mongo");

// ---------- Importing Utilities and Models ----------
const WrapAsync = require("./utils/WrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema } = require("./schema.js");
const { isLoggedIn, saveRedirectUrl } = require("./middleware.js");
const Review = require("./models/review.js");
const Listing = require("./models/listing.js");
const User = require("./models/user.js");
const { storage } = require("./cloudConfig.js");
const upload=multer({storage});
const dbUrl=process.env.ATLAS_DB_URL;



const store=MongoStore.create({
  mongoUrl:dbUrl,
  crypto:{
    secret: process.env.SECRET,
  },
  touchAfter:24*60*60,
});

store.on("error",()=>{
  console.log("ERROR IN THE MONGO SESSION STORE",err);
})

// ---------- Database Connection ----------
// const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";

main()
  .then(() => console.log("Connected to DB"))
  .catch((err) => console.error("Failed to connect to DB:", err));

async function main() {
  await mongoose.connect(dbUrl);
}

// ---------- View Engine Setup ----------
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ---------- Middleware ----------
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// Request Logger Middleware
// app.use((req, res, next) => {
//   console.log(`Request Method: ${req.method}, Request URL: ${req.url}`);
//   next();
// });

// Session and Flash Middleware
const sessionOptions = {
  store,
  secret:  process.env.SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};




app.use(session(sessionOptions));
app.use(flash());

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Flash Messages and Current User Middleware
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currentUser = req.user;
  next();
});

// ---------- Validation Middlewares ----------
const validateListing = (req, res, next) => {
  let { error } = listingSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};

const validateReview = (req, res, next) => {
  let { error } = reviewSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(",");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};

// ========================== ROUTES ==========================

// ---------- Basic Routes ----------
// app.get("/", (req, res) => {
//   res.send("Hi, I am the root route");
// });

// app.get("/demouser", async (req, res) => {
//   let fakeUser = new User({
//     email: "student@gmail.com",
//     username: "delta-student",
//   });
//   let registeredUser = await User.register(fakeUser, "helloworld");
//   res.send(registeredUser);
// });

// ---------- Listing Routes ----------

// Show All Listings
app.get("/listings", WrapAsync(async (req, res) => {
  const allListings = await Listing.find({});
  res.render("listings/index.ejs", { allListings });
}));

// Create New Listing Form
app.get("/listings/new", isLoggedIn, WrapAsync(async (req, res) => {
  res.render("listings/new.ejs", { listing: {} });
}));

app.post("/listings", isLoggedIn, upload.single('listing[image]'), WrapAsync(async (req, res) => {
  const { path: url, filename } = req.file;
  const listing = new Listing(req.body.listing);
  listing.owner = req.user._id;
  listing.image = { url, filename };
  
  await listing.save();

  req.flash("success", "New Listing Created");
  res.redirect("/listings");
}));





// Show Single Listing
app.get("/listings/:id", WrapAsync(async (req, res) => {
  let { id } = req.params;
  let listing = await Listing.findById(id).populate("reviews").populate("owner");

  if (!listing) {
    req.flash("error", "Listing you requested does not exist");
    return res.redirect("/listings");
  }

  res.render("listings/show.ejs", { listing });
}));

// Edit Listing Form
app.get("/listings/:id/edit", isLoggedIn, WrapAsync(async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing you requested does not exist");
    return res.redirect("/listings");
  }
  let originalImage=listing.image.url;
  console.log(originalImage);
  originalImage=originalImage.replace("/upload","/upload/h_200,w_350");
  res.render("listings/edit.ejs", { listing,originalImage });
}));

// Update Listing
app.put("/listings/:id", isLoggedIn,upload.single('listing[image]'), validateListing, WrapAsync(async (req, res) => {
  let { id } = req.params;
  let listing=await Listing.findByIdAndUpdate(id, { ...req.body.listing });
  if(typeof req.file !== undefined){
  let url = req.file.path;
  let filename = req.file.filename;
  listing.image={url,filename};
  await listing.save();
  }
  req.flash("success", "Listing Updated Successfully");
  res.redirect(`/listings/${id}`);
}));

// Delete Listing
app.delete("/listings/:id", isLoggedIn, WrapAsync(async (req, res) => {
  let { id } = req.params;
  await Listing.findByIdAndDelete(id);
  req.flash("success", "Listing Deleted");
  res.redirect("/listings");
}));

// ---------- Review Routes ----------

// Create New Review
app.post("/listings/:id/reviews",isLoggedIn,  WrapAsync(async (req, res) => {
  let listing = await Listing.findById(req.params.id);
  let newReview = new Review(req.body.review);
  newReview.author = req.user._id;
  await newReview.save();
  listing.reviews.push(newReview);
  await listing.save();
  req.flash("success", "New Review Added");
  res.redirect(`/listings/${listing._id}`);
}));

// Delete Review
app.delete("/listings/:id/reviews/:reviewId", WrapAsync(async (req, res) => {
  let { id, reviewId } = req.params;
  await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId);
  req.flash("success", "Review Deleted");
  res.redirect(`/listings/${id}`);
}));

// ---------- User Authentication Routes ----------

// Signup Form
app.get("/signup", (req, res) => {
  res.render("users/signup.ejs");
});

// Signup Post
app.post("/signup", WrapAsync(async (req, res) => {
  try {
    let { username, email, password } = req.body;
    const newUser = new User({ email, username });
    const registeredUser = await User.register(newUser, password);
    req.login(registeredUser, (err) => {
      if (err) return next(err);
      req.flash("success", "Welcome to WanderLust!");
      res.redirect("/listings");
    });
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/signup");
  }
}));

// Login Form
app.get("/login", (req, res) => {
  res.render("users/login.ejs");
});

// Login Post
app.post("/login", saveRedirectUrl, passport.authenticate('local', { failureRedirect: '/login', failureFlash: true }), (req, res) => {
  req.flash("success", "Welcome back!");
  let redirectUrl = res.locals.redirectUrl || "/listings";
  res.redirect(redirectUrl);
});

// Logout
app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "Logged Out Successfully");
    res.redirect("/listings");
  });
});

// ---------- Catch-All 404 Route ----------
app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found"));
});

// ---------- Error Handling Middleware ----------
app.use((err, req, res, next) => {
  let { statusCode = 500, message = "Something went wrong" } = err;
  res.status(statusCode).render("error.ejs", { err, message });
});

// ---------- Start the Server ----------
app.listen(8080, () => {
  console.log("Server is running on port 8080");
});
