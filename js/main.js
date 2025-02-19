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
  const newKey = CryptoJS.lib.WordArray.random(32).toString(); // 256-bit key
  const ciphertext = encryptData(reviewsArray, newKey);
  const encryptedKey = CryptoJS.AES.encrypt(newKey, MASTER_KEY).toString();
  localStorage.setItem(REVIEWS_STORAGE_KEY, ciphertext);
  localStorage.setItem(REVIEWS_KEY_STORAGE_KEY, encryptedKey);
}

/***********************
 * Ranking & Confetti (Optional)
 ***********************/
// Example rank calculation logic
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

// If you want to do a confetti burst when rank improves, you can do so here.
function checkRankUpgrade(email) {
  const oldRank = localStorage.getItem("userRank_" + email) || "Unranked";
  const newRank = calculateRank(email);
  if (rankValue(newRank) > rankValue(oldRank)) {
    // Confetti if rank is higher
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
  localStorage.setItem("userRank_" + email, newRank);
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

/***********************
 * Other Functionality
 ***********************/

// Google Identity Services
let currentUser = null;

window.addEventListener("DOMContentLoaded", () => {
  // Restore user from localStorage, if any
  const storedUser = localStorage.getItem("loggedInUser");
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
  }

  // Initialize star rating
  initStarRating();

  // Update UI sign-in state
  updateSignInUI();

  // Render existing reviews in showcase
  renderShowcase();

  // Typewriter effect, if you have that in your HTML
  initTypewriter();

  // *** IMPORTANT: Attach event listener to the "Submit Review" button ***
  const submitButton = document.getElementById("submit-review-btn");
  if (submitButton) {
    submitButton.addEventListener("click", submitReview);
  } else {
    console.error("Submit Review button not found! Make sure you have an element with id='submit-review-btn'.");
  }
});

function handleCredentialResponse(response) {
  // Google ID token
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
    atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
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
    const rank = localStorage.getItem("userRank_" + currentUser.email) || calculateRank(currentUser.email);
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

// Star Rating
let selectedRating = 0;
function initStarRating() {
  const starContainer = document.getElementById("star-rating");
  if (!starContainer) {
    console.error("Star rating container (#star-rating) not found in HTML.");
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

// Submit Review
function submitReview() {
  console.log("submitReview() called"); // For debugging
  if (!currentUser) {
    alert("Please sign in first.");
    return;
  }

  const titleInput = document.getElementById("review-song-title");
  const artInput = document.getElementById("review-song-art");
  const textInput = document.getElementById("review-text");

  if (!titleInput || !artInput || !textInput) {
    alert("Review form fields not found. Check your HTML.");
    return;
  }

  const title = titleInput.value.trim();
  const art = artInput.value.trim();
  const reviewText = textInput.value.trim();
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

  // Get existing reviews
  let reviews = getAllReviews();
  reviews.push(newReview);
  saveAllReviews(reviews);

  // Update rank & confetti if rank improved
  checkRankUpgrade(currentUser.email);

  alert("Review submitted successfully!");
  // Clear form fields
  titleInput.value = "";
  artInput.value = "";
  textInput.value = "";
  selectedRating = 0;
  highlightStars(0, document.querySelectorAll("#star-rating i"));

  // Refresh UI
  updateSignInUI();
  renderShowcase();
}

// Showcase
function renderShowcase() {
  const ratedSongs = document.getElementById("rated-songs");
  if (!ratedSongs) {
    console.error("#rated-songs container not found. Check your HTML.");
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

    // Show delete button if admin
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

// Example typewriter effect
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
