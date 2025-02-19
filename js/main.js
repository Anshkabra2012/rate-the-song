/***********************
 * Encryption Utilities
 ***********************/
const MASTER_KEY = "11992091987021652611158681308931";
const REVIEWS_STORAGE_KEY = "x9c3";
const REVIEWS_KEY_STORAGE_KEY = "x9c3_key";

function encryptData(data, key) {
  const plaintext = JSON.stringify(data);
  return CryptoJS.AES.encrypt(plaintext, key).toString();
}

function decryptData(ciphertext, key) {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decrypted);
  } catch (err) {
    console.error("Decryption failed:", err);
    return [];
  }
}

function getAllReviews() {
  const encryptedKey = localStorage.getItem(REVIEWS_KEY_STORAGE_KEY);
  const ciphertext = localStorage.getItem(REVIEWS_STORAGE_KEY);
  if (!encryptedKey || !ciphertext) return [];
  const bytes = CryptoJS.AES.decrypt(encryptedKey, MASTER_KEY);
  const currentKey = bytes.toString(CryptoJS.enc.Utf8);
  return decryptData(ciphertext, currentKey);
}

function saveAllReviews(reviewsArray) {
  const newKey = CryptoJS.lib.WordArray.random(32).toString(); // 256-bit key
  const ciphertext = encryptData(reviewsArray, newKey);
  const encryptedKey = CryptoJS.AES.encrypt(newKey, MASTER_KEY).toString();
  localStorage.setItem(REVIEWS_STORAGE_KEY, ciphertext);
  localStorage.setItem(REVIEWS_KEY_STORAGE_KEY, encryptedKey);
}

/***********************
 * Ranking Utilities
 ***********************/
function getUserReviewCount(email) {
  const reviews = getAllReviews();
  return reviews.filter(r => r.userEmail === email).length;
}

function calculateRank(email) {
  const count = getUserReviewCount(email);
  if (count >= 31) return "Diamond";
  else if (count >= 21) return "Platinum";
  else if (count >= 11) return "Gold";
  else if (count >= 6)  return "Silver";
  else if (count >= 1)  return "Bronze";
  return "Unranked";
}

function rankValue(rank) {
  switch (rank) {
    case "Unranked": return 0;
    case "Bronze":   return 1;
    case "Silver":   return 2;
    case "Gold":     return 3;
    case "Platinum": return 4;
    case "Diamond":  return 5;
    default:         return 0;
  }
}

function checkRankUpgrade(email) {
  const oldRank = localStorage.getItem("userRank_" + email) || "Unranked";
  const newRank = calculateRank(email);
  if (rankValue(newRank) > rankValue(oldRank)) {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
  localStorage.setItem("userRank_" + email, newRank);
}

function getUserRank(email) {
  const savedRank = localStorage.getItem("userRank_" + email);
  return savedRank ? savedRank : calculateRank(email);
}

/***********************
 * Rate Limiting Utilities
 ***********************/
const REVIEW_LIMIT = 2;                        // Non-admin users: 2 reviews
const LIMIT_DURATION = 30 * 60 * 1000;          // 30 minutes

function canSubmitReview() {
  const now = Date.now();
  let timestamps = JSON.parse(localStorage.getItem("reviewTimestamps") || "[]");
  timestamps = timestamps.filter(ts => now - ts < LIMIT_DURATION);
  return timestamps.length < REVIEW_LIMIT;
}

function addReviewTimestamp() {
  const now = Date.now();
  let timestamps = JSON.parse(localStorage.getItem("reviewTimestamps") || "[]");
  timestamps.push(now);
  localStorage.setItem("reviewTimestamps", JSON.stringify(timestamps));
}

/***********************
 * End Rate Limiting
 ***********************/

/***********************
 * Other Functionality
 ***********************/
// Initialize Curse Filter dictionary (ensure the library is loaded)
if (typeof CurseFilter !== "undefined") {
  CurseFilter.loadDictionary();
}

// Particles.js Background
particlesJS("particles-js", {
  "particles": {
    "number": { "value": 80, "density": { "enable": true, "value_area": 800 } },
    "color": { "value": "#ffffff" },
    "shape": { "type": "circle" },
    "opacity": { "value": 0.3 },
    "size": { "value": 3, "random": true },
    "line_linked": { "enable": true, "distance": 150, "color": "#ffffff", "opacity": 0.1, "width": 1 },
    "move": { "enable": true, "speed": 2 }
  },
  "interactivity": {
    "events": {
      "onhover": { "enable": true, "mode": "grab" },
      "onclick": { "enable": true, "mode": "push" }
    }
  },
  "retina_detect": true
});

// Google Identity Services
let currentUser = null;
window.addEventListener("DOMContentLoaded", () => {
  const storedUser = localStorage.getItem("loggedInUser");
  if (storedUser) currentUser = JSON.parse(storedUser);
  initStarRating();
  updateSignInUI();
  renderShowcase();
  initTypewriter();

  const submitButton = document.getElementById("submit-review-btn");
  if (submitButton) {
    submitButton.addEventListener("click", submitReview);
  } else {
    console.error("Submit Review button not found! Ensure an element with id 'submit-review-btn' exists.");
  }

  // Show admin panel if user is admin
  if (isAdmin()) {
    const adminPanel = document.getElementById("admin-panel");
    if (adminPanel) adminPanel.style.display = "block";
  }
});

function handleCredentialResponse(response) {
  const token = response.credential;
  const payload = parseJwt(token);
  currentUser = {
    name: payload.name,
    email: payload.email,
    picture: payload.picture
  };
  localStorage.setItem("loggedInUser", JSON.stringify(currentUser));
  updateSignInUI();
}

function parseJwt(token) {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
  return JSON.parse(jsonPayload);
}

function handleSignOut() {
  localStorage.removeItem("loggedInUser");
  currentUser = null;
  updateSignInUI();
}

function updateSignInUI() {
  const userGreeting = document.getElementById("user-greeting");
  const signoutLink = document.getElementById("signout-link");
  const reviewSection = document.getElementById("review-section");

  if (currentUser) {
    const rank = getUserRank(currentUser.email);
    userGreeting.style.display = "block";
    userGreeting.textContent = `Signed in as ${currentUser.name} (${currentUser.email}) [${rank}]`;
    signoutLink.style.display = "inline";
    reviewSection.classList.remove("disabled");
  } else {
    userGreeting.style.display = "none";
    signoutLink.style.display = "none";
    reviewSection.classList.add("disabled");
  }
}

// Star Rating System
let selectedRating = 0;
function initStarRating() {
  const starContainer = document.getElementById("star-rating");
  if (!starContainer) {
    console.error("Star rating container (#star-rating) not found.");
    return;
  }
  const stars = starContainer.querySelectorAll("i");
  stars.forEach(star => {
    star.addEventListener("mouseover", () => {
      const value = parseInt(star.getAttribute("data-value"));
      highlightStars(value, stars);
    });
    star.addEventListener("mouseout", () => {
      highlightStars(selectedRating, stars);
    });
    star.addEventListener("click", () => {
      selectedRating = parseInt(star.getAttribute("data-value"));
      star.classList.add("animate__heartBeat");
      highlightStars(selectedRating, stars);
    });
  });
}

function highlightStars(rating, stars) {
  stars.forEach(s => {
    const starValue = parseInt(s.getAttribute("data-value"));
    if (starValue <= rating) {
      s.classList.add("selected");
      s.classList.remove("hovered");
    } else {
      s.classList.remove("selected");
      s.classList.remove("hovered");
    }
  });
}

// iTunes Search using JSONP (for static GitHub Pages)
function jsonp(url, callbackName) {
  const script = document.createElement("script");
  script.src = url + "&callback=" + callbackName;
  document.body.appendChild(script);
  script.onload = () => document.body.removeChild(script);
}

function handleItunesResults(data) {
  renderResults(data.results);
}

const songSearch = document.getElementById("song-search");
const resultsContainer = document.getElementById("results");
songSearch.addEventListener("input", function() {
  const query = this.value.trim();
  if (query.length < 2) {
    resultsContainer.innerHTML = "";
    return;
  }
  const url = `https://itunes.apple.com/search?entity=song&country=us&limit=6&term=${encodeURIComponent(query)}`;
  jsonp(url, "handleItunesResults");
});

function renderResults(songs) {
  resultsContainer.innerHTML = "";
  songs.forEach(song => {
    const card = document.createElement("div");
    card.className = "song-card";
    const artwork = song.artworkUrl100 || "";
    const trackName = song.trackName || "Unknown Title";
    const artistName = song.artistName || "Unknown Artist";
    const collectionName = song.collectionName || "Unknown Album";
    card.innerHTML = `
      <img src="${artwork}" alt="Album Art" />
      <div class="song-details">
        <h3>${trackName}</h3>
        <p><i class="fas fa-user"></i> ${artistName}</p>
        <p><i class="fas fa-compact-disc"></i> ${collectionName}</p>
        <button onclick="selectSong('${trackName.replace(/'/g, "\\'")}', '${artwork}')">
          <i class="fas fa-edit"></i> Review
        </button>
      </div>
    `;
    resultsContainer.appendChild(card);
  });
}

function selectSong(title, art) {
  if (!currentUser) {
    alert("Please sign in before reviewing a song.");
    return;
  }
  document.getElementById("review-song-title").value = title;
  document.getElementById("review-song-art").value = art;
  selectedRating = 0;
  highlightStars(0, document.querySelectorAll("#star-rating i"));
  document.getElementById("review-section").scrollIntoView({ behavior: "smooth" });
}

// Submit Review with Rate Limiting, Curse Filter, Encryption, and Rank Update
function submitReview() {
  console.log("submitReview() called");
  if (!currentUser) {
    alert("Please sign in first.");
    return;
  }

  // For non-admin users, enforce a limit of 2 reviews per 30 minutes
  if (!isAdmin() && !canSubmitReview()) {
    alert("You have reached the review limit (2 reviews per 30 minutes). Please try again later.");
    return;
  }

  const titleInput = document.getElementById("review-song-title");
  const artInput = document.getElementById("review-song-art");
  const textInput = document.getElementById("review-text");

  if (!titleInput || !artInput || !textInput) {
    alert("Review form fields not found. Check your HTML.");
    return;
  }

  let title = titleInput.value.trim();
  let art = artInput.value.trim();
  let reviewText = textInput.value.trim();
  const rating = selectedRating;

  if (!title || !art) {
    alert("Please select a song before reviewing.");
    return;
  }
  if (!reviewText) {
    alert("Please enter your review text.");
    return;
  }
  if (rating === 0) {
    alert("Please select a star rating (1–5).");
    return;
  }

  // Filter out vulgar words using Curse Filter (if loaded)
  if (typeof CurseFilter !== "undefined") {
    reviewText = CurseFilter.clean(reviewText);
  }

  const newReview = {
    title,
    art,
    user: currentUser.name,
    userEmail: currentUser.email,
    reviewText,
    rating,
    timestamp: new Date().toISOString(),
    picture: currentUser.picture
  };

  let reviews = getAllReviews();
  reviews.push(newReview);
  saveAllReviews(reviews);

  // For non-admin users, record the review timestamp for rate limiting
  if (!isAdmin()) {
    addReviewTimestamp();
  }

  // Update user rank and trigger celebration if rank increases
  checkRankUpgrade(currentUser.email);

  alert("Review submitted successfully!");

  // Clear the form fields and reset the rating.
  titleInput.value = "";
  artInput.value = "";
  textInput.value = "";
  selectedRating = 0;
  highlightStars(0, document.querySelectorAll("#star-rating i"));
  updateSignInUI();
  renderShowcase();

  // Use a short timeout to allow the alert to finish, then reload the page
  setTimeout(() => {
    window.location.reload();
  }, 100);
}

// Showcase Rendering
function renderShowcase() {
  const ratedSongs = document.getElementById("rated-songs");
  if (!ratedSongs) {
    console.error("#rated-songs container not found.");
    return;
  }
  const reviews = getAllReviews();
  ratedSongs.innerHTML = "";
  reviews.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "rated-card";
    card.innerHTML = `
      <img src="${item.art}" alt="Album Art" />
      <div class="rated-details">
        <h4>${item.title}</h4>
        <p><i class="fas fa-user"></i> ${item.user}</p>
        <p><i class="fas fa-star"></i> ${item.rating}/5</p>
        <p><i class="fas fa-comment"></i> ${item.reviewText}</p>
      </div>
      <button class="delete-btn" onclick="deleteReview(${index})">
        <i class="fas fa-trash"></i>
      </button>
    `;
    ratedSongs.appendChild(card);
    if (isAdmin()) {
      card.querySelector(".delete-btn").style.display = "block";
    }
  });
}

function deleteReview(index) {
  if (!isAdmin()) {
    alert("Only admin can delete reviews!");
    return;
  }
  let reviews = getAllReviews();
  if (index < 0 || index >= reviews.length) return;
  reviews.splice(index, 1);
  saveAllReviews(reviews);
  renderShowcase();
  updateSignInUI();
}

// Typewriter Effect in Navigation
function initTypewriter() {
  const typewriterElement = document.getElementById("typewriter");
  if (!typewriterElement) return;
  const typewriter = new Typewriter(typewriterElement, {
    loop: true,
    delay: 75,
  });
  typewriter
    .typeString("Song Rater")
    .pauseFor(1200)
    .deleteAll()
    .typeString("Rate Songs, Earn Ranks, Have Fun!")
    .pauseFor(2000)
    .start();
}

function isAdmin() {
  return currentUser && currentUser.email === "resoluteplanes@gmail.com";
}

/***********************
 * Admin-Only Rank Override
 ***********************/
function adminSetUserRank() {
  if (!isAdmin()) {
    alert("Unauthorized: Only admin can set user ranks.");
    return;
  }
  if (!canAdminOverride()) {
    alert("Please wait a minute before submitting another override.");
    return;
  }
  const targetEmail = document.getElementById("admin-email-input").value.trim();
  const selectedRank = document.getElementById("admin-rank-select").value;
  if (!targetEmail) {
    alert("Please enter a user email.");
    return;
  }
  localStorage.setItem("userRank_" + targetEmail, selectedRank);
  recordAdminOverride();
  alert("Rank for " + targetEmail + " has been set to " + selectedRank + ".");
}

function recordAdminOverride() {
  localStorage.setItem("adminOverrideTimestamp", Date.now().toString());
}

function canAdminOverride() {
  const last = localStorage.getItem("adminOverrideTimestamp");
  if (!last) return true;
  return (Date.now() - parseInt(last)) >= 60 * 1000; // 1 minute
}
