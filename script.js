document.getElementById("input").addEventListener("input", ()=>{
const apiKey = "5ea06e9947134";
const uploadFileName = inp.files[0].name // page should have <input type="file"> for upload selector (i.e. inp=document.createElement("input");inp.type="file";document.body.appendChild(inp);
const targetBucket = "test-bucket-tyler";
const targetAccessKey = "GOOG1ERY4IOIV6NSUVYR2YNRCETCSZEJ2X3PCCMD3ORDN2LZPGK4D5J3S7JTA";
const targetSecret = "+atHC9PvyeMT64vYX+tBcWtyBPEgkLrqj0A1OtvL";

const uploadSteps = [
  getSessionToken,
  createTask,
  getUploadUrl,
  uploadFileAndStartTask,
  checkStatus];

let sessionToken, taskToken, uploadRequestUrl, uploadUrl, statusUrl;

uploadSteps.reduce((chain, step)=>{
  return chain.then(step);
}, Promise.resolve());

function getSessionToken() {
  log("Requesting session token");
  return fetch("https://api.qencode.com/v1/access_token", {
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    method: "post",
    body: `api_key=${apiKey}`
  }).then(resp=>resp.json()).then(resp=>{
    console.dir(resp);
    sessionToken = resp.token;
  });
}

function createTask() {
  log("Creating new task");
  return fetch("https://api.qencode.com/v1/create_task", {
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    method: "post",
    body: `token=${sessionToken}`
  }).then(resp=>resp.json()).then(resp=>{
    console.dir(resp);
    ({task_token: taskToken, upload_url: uploadRequestUrl} = resp);
  });
}

function getUploadUrl() {
  log("Retrieving upload url");
  return fetch(`${uploadRequestUrl}/${taskToken}`, {
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "Tus-Resumable": "1.0.0",
      "Upload-Length": inp.files[0].size,
      "Upload-Metadata": `filename ${uploadFileName}`
    },
    method: "post",
    body:""
  }).then(resp=>{
    console.dir(Array.from(resp.headers));
    uploadUrl = resp.headers.get("location");
  });
}

function uploadFileAndStartTask() {
  // return Promise.all([uploadFile(), startTask()]);
  return uploadFile().then(startTask);
}

function uploadFile() {
  log("Uploading file");
  return fetch(uploadUrl, {
    headers: {
      "Tus-Resumable": "1.0.0",
      "content-type": "application/offset+octet-stream",
      "Upload-Offset": "0"
    },
    method: "PATCH",
    body: inp.files[0]
  }).then(resp=>{
    console.dir(Array.from(resp.headers));
    log(`Upload ${resp.headers.get("upload-offset") === String(inp.files[0].size) ? "" : "partially "} complete`);
  });
}

function startTask() {
  log("Starting task");
  let taskConfig = {
    "query": {
      "source": `tus:${uploadUrl.split("/").pop()}`,
      "format": [
        {
          "output": "mp4",
          //"optimize_bitrate": 1, // per-title encoding for stream based processing
          //"adjust_crf": "-1",
          "destination": {
            "url": `s3://storage.googleapis.com/${targetBucket}/${encodeURIComponent(inp.files[0].name)}`,
            "key": targetAccessKey,
            "secret": encodeURIComponent(targetSecret)
          }
        }
      ]
    }
  };

  return fetch("https://api.qencode.com/v1/start_encode2", {
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    method: "post",
    body: `task_token=${taskToken}&query=${JSON.stringify(taskConfig)}`
  }).then(resp=>{
    console.dir(Array.from(resp.headers));
    return resp.json();
  }).then(resp=>{
    statusUrl = resp.status_url;
    log(statusUrl);
  });
}

function checkStatus(attempt = 1) {
  if (attempt === 10) { return Promise.resolve(); }
  return wait(5000)
  .then(()=>fetch(statusUrl,{
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    method:"post",
    body:`task_tokens=${taskToken}`
  })).then(resp=>resp.json()).then(resp=>{
    log(`Current status: ${resp.statuses[taskToken].status}`);
    return resp.statuses[taskToken].status === "completed" ? "" : checkStatus(attempt + 1);
  });
}

function wait(ms = 5000) {
  if (ms < 0 || ms > 60000) {ms = 5000;}
  return new Promise(res=>setTimeout(res, ms));
}

function log(text = "") {
  let outputElement = document.createElement("p");
  p.innerText = text;
  document.body.appendChild(outputElement);
}
});
