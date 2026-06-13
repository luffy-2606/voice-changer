const fs = require('fs');
const path = require('path');
const https = require('https');

const targetDir = path.join(__dirname, 'public', 'models', 'kokoro');

// Ensure directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const files = [
  {
    url: 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_q8f16.onnx',
    filename: 'model.onnx'
  },
  {
    url: 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/tokenizer.json',
    filename: 'tokenizer.json'
  },
  {
    url: 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/tokenizer_config.json',
    filename: 'tokenizer_config.json'
  },
  {
    url: 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/config.json',
    filename: 'config.json'
  }
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        const redirectUrl = new URL(
          response.headers.location,
          url
        ).toString();

        downloadFile(redirectUrl, dest)
          .then(resolve)
          .catch(reject);

        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (Status Code: ${response.statusCode})`));
        return;
      }

      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => { });
      reject(err);
    });
  });
}

async function main() {
  for (const file of files) {
    const dest = path.join(targetDir, file.filename);
    console.log(`Downloading ${file.filename} from ${file.url}...`);
    try {
      await downloadFile(file.url, dest);
      console.log(`Successfully downloaded ${file.filename}`);
    } catch (err) {
      console.error(`Error downloading ${file.filename}:`, err);
      process.exit(1);
    }
  }
  console.log("All model files downloaded successfully.");
}

main();
