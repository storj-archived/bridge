#! /bin/bash

ARGS='host thor help'

if [ "$#" -gt 0 ]; then
	ARGS="host thor $*"
fi

if [ "$1" == "bash:container" ]; then
  echo "Please run \`./container.sh bash:container\` instead"
  exit 1
fi

if [ "$1" == "bash:container" ]; then
  ARGS="host /bin/bash"
fi

if [ "$1" == "--update" ]; then
  ARGS="host thor docker:build thor"
fi

if [ -f ./dockerfiles/thor.yml ]; then
	docker-compose -f ./dockerfiles/thor.yml run $ARGS
	exit 0
elif [ -f ../dockerfiles/thor.yml ]; then
	docker-compose -f ../dockerfiles/thor.yml run $ARGS
	exit 0
else
  echo "Couldn't find thor.yml docker composition file at either ./dockerfiles/thor.yml or ../dockerfiles/thor.yml"
  exit 1
fi

