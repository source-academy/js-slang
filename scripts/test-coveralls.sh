#!/usr/bin/env bash

set -euo pipefail

jest --coverage --coverageReporters=text-lcov | \
  coveralls
