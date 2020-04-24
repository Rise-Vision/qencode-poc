document.querySelector("input").addEventListener("input", (evt)=>{
  const uploadDOMElement = evt.target;
  const file = uploadDOMElement.files[0];
  const apiKey = "5ea06e9947134";
  const targetBucket = "test-bucket-tyler";
  const targetAccessKey = "GOOG1ERY4IOIV6NSUVYR2YNRCETCSZEJ2X3PCCMD3ORDN2LZPGK4D5J3S7JTA";
  const targetSecret = "+atHC9PvyeMT64vYX+tBcWtyBPEgkLrqj0A1OtvL";

  const uploadSteps = [
    getSessionToken,
    createTask,
    startUpload,
    startTask,
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

  function startUpload() {
    log("Starting upload");

    let tusUpload;
    return new Promise((res, rej)=>{
      let  options = {
        endpoint: `${uploadRequestUrl}/${taskToken}`,
        retryDelays: [0, 1000, 3000, 5000],
        metadata: {
          filename: file.name,
          filetype: file.type
        },
        onError: err=>{log(err); rej();},
        onProgress: (bytesUploaded, bytesTotal)=>{
          let pct = (`${(bytesUploaded / bytesTotal * 100).toFixed(2)}%`);
          document.querySelector("#uploadProgress").textContent = pct;
          console.log(bytesUploaded, bytesTotal);
        },
        onSuccess: ()=>{uploadUrl = tusUpload.url; res();}
      };

      tusUpload = new tus.Upload(file, options);
      tusUpload.start();
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
            "destination": {
              "url": `s3://storage.googleapis.com/${targetBucket}/${encodeURIComponent(file.name)}`,
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
    });
  }

  function checkStatus(attempt = 0) {
    return wait(5000)
    .then(()=>fetch(statusUrl,{
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      method:"post",
      body:`task_tokens=${taskToken}`
    })).then(resp=>resp.json()).then(resp=>{
      if (!resp.statuses) return;
      let taskStatus = resp.statuses[taskToken];
      if (!taskStatus) return;

      if (resp.statuses[taskToken].status_url) {statusUrl = taskStatus.status_url;}

      log(`Current status: ${taskStatus.status} - Percent: ${taskStatus.percent}`);
      console.dir(taskStatus);
      if (taskStatus.status === "completed") {
        if (taskStatus.videos) {
          let sourceSize = (taskStatus.source_size/Math.pow(2, 20)).toFixed(2);
          let destinationSize = (Number(taskStatus.videos[0].size)).toFixed(2);
          log(`Compression: ${sourceSize} MiB => ${destinationSize}MiB`);
        }
        return Promise.resolve();
      } else {
        return checkStatus(attempt + 1);
      }
    });
  }

  function wait(ms = 5000) {
    if (ms < 1000 || ms > 60000) {ms = 5000;}
    return new Promise(res=>setTimeout(res, ms));
  }

  function log(text = "") {
    if (typeof text === "object") {text = text.toString();}
    let outputElement = document.createElement("p");
    outputElement.textContent = `${(new Date()).toLocaleString()}: ${text}`;
    document.body.appendChild(outputElement);
  }
});
