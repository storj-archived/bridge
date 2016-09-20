.SILENT:
.DEFAULT:

shortdesc:
	echo "develop	- manages bridge server's docker composition using 'develop' env" | fold -s

longdesc:
	echo 'Usage: `make develop <subcommand>`' | fold -s
	echo ''
	echo "Manages bridge server's docker composition using 'develop' env." | fold -s
	echo ''
	echo 'This docker composition mounts the project directory as a volume and is intended to be used for development.' | fold -s
	echo ''
	echo 'Subcommands:'

help: longdesc
	@echo '	build	- `docker-compose build`'
	@echo '	up	- `docker-compose up`'
	@echo '	down	- `docker-compose down`'

%:
	docker-compose -f dockerfiles/bridge-develop.yml $(MAKECMDGOALS)

.PHONY: % #all targets are phony
