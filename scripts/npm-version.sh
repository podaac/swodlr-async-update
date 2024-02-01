#!/bin/bash
npm version $BUMPVER_NEW_VERSION --no-commit-hooks --no-git-tag-version
git add package.json package-lock.json
