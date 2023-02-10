let hubDataObj = {};

// Store Hub data from dd tag
let storeData = () => {
  const dds = document.querySelectorAll("dd");
  // Obj maintains order so we know that 0 index belongs to HubID and so on.
  for (const [index, dd] of dds.entries()) {
    hubDataObj[index] = dd.innerHTML;
  }
  hubDataObj[2] = hubDataObj[2].replace(/\|\|/g, "").replace(/\^\^/g, "");
};

let saveFile = () => {
  // This variable stores all the data.
  let info =
    "\r This file has confidential information. Please keep it safe!\n" +
    "\r In case of file lost or theft. Immediately contact Central Platform" +
    " \r\n " +
    "Hub ID: " +
    hubDataObj[0] +
    " \r\n " +
    "Hub Name: " +
    hubDataObj[1] +
    "\r\n " +
    "Decryption key: " +
    hubDataObj[2] +
    "\r\n " +
    "OpenID Connect Client ID: " +
    hubDataObj[3] +
    " \r\n " +
    "OpenID Connect Client Password: " +
    hubDataObj[4];

  // Convert the text to BLOB.
  const textToBLOB = new Blob([info], { type: "text/plain" });
  let newLink = document.createElement("a");

  // Get current date and append it to a the hubName for filename purpose.
  const today = new Date();
  const date = today.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  //File Name
  newLink.download = hubDataObj[1] + date;

  if (window.webkitURL != null) {
    newLink.href = window.webkitURL.createObjectURL(textToBLOB);
  } else {
    newLink.href = window.URL.createObjectURL(textToBLOB);
    newLink.style.display = "none";
    document.body.appendChild(newLink);
  }

  newLink.click();
};

document.querySelector(".dwnld-btn").addEventListener("click", function () {
  storeData();
  saveFile();
});
