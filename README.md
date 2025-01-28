# Tennis-Video-Viewer

[![Deploy to Firebase Hosting on merge](https://github.com/awest25/Tennis-Video-Viewer/actions/workflows/firebase-hosting-merge.yml/badge.svg)](https://github.com/awest25/Tennis-Video-Viewer/actions/workflows/firebase-hosting-merge.yml)

A web app focused on tennis match playback integrating with point-level data, supporting filtering the match by point attributes.

# Getting Started

1. Clone the repo
2. Run `npm install` to install dependencies
3. Run `npm run dev` to run the test server
4. Navigate to `localhost:3000` in your browser

# Development Notes

A firestore database was created. A web app was linked in Project Settings -> Apps -> Web App. The config object was copied into the firebaseInit file.

Before uploading a CSV, it must be converted to JSON. Use csvjson.com.

## Deployment

1. Run `npm run build` to generate production files
2. Run `firebase deploy` to depoly to firebase

## Uploading a Match

1. Navigate to `/upload-match`
2. For the Video ID, use the part after `v=` in the URL
3. The PDF file is optional

## Recommended VS Code Extensions

- ESLint
- Prettier

These extensions will automatically format your code on save. The list is configured in `.vscode/extensions.json`.
