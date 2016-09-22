.SILENT:
.DEFAULT:

shortdesc:
	echo "test	- run test suite(s)" | fold -s

longdesc:
	echo 'Usage: `make test <suite>`' | fold -s
	echo ''
	echo "Run target test suite" | fold -s
	echo ''
	echo 'Suites:'

help: longdesc
	@echo '	e2e	- ruby end-to-end tests using selenium and cucumber'
	@echo '	integration	- javascript integration tests'
	@echo '	unit	- javascript unit tests'

e2e:
	docker-compose -f dockerfiles/selenium.yml up

%:
	echo "$@ called and matched by %"


.PHONY: % #all targets are phony
