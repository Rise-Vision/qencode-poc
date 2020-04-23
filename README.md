# Qencode POC

 - Uploads file to Qencode
 - Starts encoding and directly Qencode to upload to GCS when complete
 - Shows status

### POC Limitations

 - no error handling
 - hard coded destination bucket
 - hard coded bucket credentials
 - hard coded api key
 - no upload progress bar

### Run

 1. Start a local http server and load test.html
 2. Choose a file to upload

### See Also

This [repo] from Qencode which has a progress bar but requires modification.

[repo]: https://github.com/qencode-dev/video-transcoder.online
