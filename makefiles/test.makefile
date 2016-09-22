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
	if [ $@ == $(firstword $(MAKECMDGOALS)) ]; then \
		if [ $(word 2, $(MAKECMDGOALS)) == 'only' ]; then \
			docker-compose -f dockerfiles/selenium-test-only.yml run ruby; \
		else \
			docker-compose -f dockerfiles/selenium-test.yml run ruby; \
		fi; \
	fi

%:
	if [ $@ == $(firstword $(MAKECMDGOALS)) ]; then \
		echo "$@ called and matched by %"; \
	fi

.PHONY: % #all targets are phony
