#!/bin/bash

rm -rf build
mkdir build

cp -r lib schemas build
cp package.json package-lock.json build
npm ci --omit dev --prefix build --quiet

rm -rf dist
mkdir dist

PACKAGE_NAME=$(npm pkg get name version | jq -r ".name + \"-\" + .version")
zip -r "dist/$PACKAGE_NAME.zip" build/*
