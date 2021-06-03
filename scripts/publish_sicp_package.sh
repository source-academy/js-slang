#! /bin/bash

publish() {
    cd sicp_publish
    npm version patch
    npm publish
}

publish