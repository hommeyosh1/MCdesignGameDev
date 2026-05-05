let watchSeconds = 0;
let timer = null;

const video = document.getElementById("courseVideo");
const watchTimeText = document.getElementById("watchTime");

if (video) {
  video.addEventListener("play", function () {
    timer = setInterval(function () {
      watchSeconds++;
      watchTimeText.innerText = "Watch Time: " + watchSeconds + " seconds";
      localStorage.setItem("part20WatchTime", watchSeconds);
    }, 1000);
  });

  video.addEventListener("pause", function () {
    clearInterval(timer);
  });

  video.addEventListener("ended", function () {
    clearInterval(timer);
  });
}

const savedWatchTime = document.getElementById("savedWatchTime");

if (savedWatchTime) {
  const savedTime = localStorage.getItem("part20WatchTime") || 0;
  savedWatchTime.innerText = "Total Watch Time: " + savedTime + " seconds";
}

function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const message = document.getElementById("loginMessage");

  if (username === "builder" && password === "1234") {
    message.innerText = "Login successful!";
    window.location.href = "dashboard.html";
  } else {
    message.innerText = "Wrong login.";
  }
}
function handleUpload() {
  const title = document.getElementById("title").value;
  const description = document.getElementById("description").value;
  const video = document.getElementById("videoFile").files[0];
  const asset = document.getElementById("assetFile").files[0];
  const type = document.getElementById("courseType").value;
  const status = document.getElementById("uploadStatus");

  if (!title || !video) {
    status.innerText = "Title and video are required.";
    return;
  }

  // Fake upload simulation (for now)
  status.innerText = "Uploading...";

  setTimeout(() => {
    status.innerText = "Upload complete (LOCAL DEMO ONLY)";

    // Save basic data locally
    const course = {
      title: title,
      description: description,
      videoName: video.name,
      assetName: asset ? asset.name : "None",
      type: type,
    };

    let courses = JSON.parse(localStorage.getItem("courses")) || [];
    courses.push(course);
    localStorage.setItem("courses", JSON.stringify(courses));
  }, 2000);
}
