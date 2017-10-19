#!/bin/bash

for TAG in "$@"; do
  docker push $TAG
  result=$?
done

if [[ $result != 0 ]]; then
  echo "Error pushing docker image"
  exit 1
fi

echo "Success..."
exit 0
