/***********************
 * Encryption Utilities
 ***********************/
const MASTER_KEY = "9f86d081884c7d659a2feaa0c55ad015a3bf4f13b4371b0f5e07394c7063be60";
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
  const newKey = CryptoJS.lib.WordArray.random(32).toString();
  const ciphertext = encryptData(reviewsArray, newKey);
  const encryptedKey = CryptoJS.AES.encrypt(newKey, MASTER_KEY).toString();
  localStorage.setItem(REVIEWS_STORAGE_KEY, ciphertext);
  localStorage.setItem(REVIEWS_KEY_STORAGE_KEY, encryptedKey);
}

/***********************
 * Ranking System Utilities
 ***********************/
// Compute rank based on review count
function calculateRank(email) {
  const count = getUserReviewCount(email);
  if (count >= 31) return "Diamond";
  else if (count >= 21) return "Platinum";
  else if (count >= 11) return "Gold";
  else if (count >= 6) return "Silver";
  else if (count >= 1) return "Bronze";
  return "Unranked";
}

// Helper to get a numeric value for a rank (for comparison)
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

// Get the user's saved rank if it exists; otherwise, calculate it
function getUserRank(email) {
  const savedRank = localStorage.getItem("userRank_" + email);
  if (savedRank) return savedRank;
  return calculateRank(email);
}

// After a review is submitted, update the user’s rank and celebrate if they've leveled up.
function updateUserRank(email) {
  const newRank = calculateRank(email);
  let oldRank = localStorage.getItem("userRank_" + email) || "Unranked";
  // If the new rank is higher than the old rank, celebrate!
  if (rankValue(newRank) > rankValue(oldRank)) {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
  localStorage.setItem("userRank_" + email, newRank);
}

// Count how many reviews a user has posted
function getUserReviewCount(email) {
  const reviews = getAllReviews();
  return reviews.filter(r => r.userEmail === email).length;
}

/***********************
 * End Ranking Utilities
 ***********************/

/***********************
 * Other Functionality
 ***********************/
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
  const jsonPayload = decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
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
    userGreeting.innerHTML = `Signed in as ${currentUser.name} (${currentUser.email}) [${rank}]`;
    signoutLink.style.display = "inline";
    reviewSection.classList.remove("disabled");

    // If admin, show the rank override control.
    if (isAdmin()) {
      document.getElementById("admin-rank-control").style.display = "block";
    }
  } else {
    userGreeting.style.display = "none";
    signoutLink.style.display = "none";
    reviewSection.classList.add("disabled");
    document.getElementById("admin-rank-control").style.display = "none";
  }
}

// Star Rating System
let selectedRating = 0;
function initStarRating() {
  const starContainer = document.getElementById("star-rating");
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

// iTunes Search
const songSearch = document.getElementById("song-search");
const resultsContainer = document.getElementById("results");
songSearch.addEventListener("input", async function() {
  const query = this.value.trim();
  if (query.length < 2) { resultsContainer.innerHTML = ""; return; }
  const url = `https://itunes.apple.com/search?entity=song&country=us&limit=6&term=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    renderResults(data.results);
  } catch (err) {
    console.error("Error searching songs:", err);
  }
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

// Submit Review with Encryption, Key Rotation, and Rank Update
function submitReview() {
  if (!currentUser) {
    alert("Please sign in first.");
    return;
  }
  const title = document.getElementById("review-song-title").value.trim();
  const art = document.getElementById("review-song-art").value.trim();
  const reviewText = document.getElementById("review-text").value.trim();
  const rating = selectedRating;
  if (!title || !art || !reviewText || rating === 0) {
    alert("Please fill out all fields and select a star rating.");
    return;
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
  
  // Update the user's rank based on the new review count
  updateUserRank(currentUser.email);
  
  alert("Review submitted!");
  document.getElementById("review-song-title").value = "";
  document.getElementById("review-song-art").value = "";
  document.getElementById("review-text").value = "";
  selectedRating = 0;
  highlightStars(0, document.querySelectorAll("#star-rating i"));
  updateSignInUI();
  renderShowcase();
}

// Showcase Rendering
function renderShowcase() {
  const ratedSongs = document.getElementById("rated-songs");
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

// Utility: Check if current user is admin (hardcoded email)
function isAdmin() {
  return currentUser && currentUser.email === "resoluteplanes@gmail.com";
}

/***********************
 * Admin Rank Override (Only visible to admin)
 ***********************/
function setUserRankOverride() {
  const selectedRank = document.getElementById("admin-rank-select").value;
  localStorage.setItem("userRank_" + currentUser.email, selectedRank);
  alert("User rank overridden to " + selectedRank);
  updateSignInUI();
}
