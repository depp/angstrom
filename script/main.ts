function loaded() {
  alert("Loaded");
}

if (document.readyState == "complete") {
  loaded();
} else {
  window.addEventListener("load", loaded);
}
