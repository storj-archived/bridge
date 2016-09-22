.SILENT:
.DEFAULT:

MAKEFILES_DIR = makefiles

help:
	if [ $(firstword $(MAKECMDGOALS)) == $@ ]; then \
		echo 'Run `make <command> help` for more specific help' | fold -s; \
		echo ''; \
		echo 'commands:'; \
		for file in $(wildcard $(MAKEFILES_DIR)/*); do \
			echo "	`$(MAKE) -f $$file shortdesc`"; \
		done \
	fi

test: run-tests

run-tests:
	if [ $(firstword $(MAKECMDGOALS)) == $@ ]; then \
		$(MAKE) -f $(MAKEFILES_DIR)/test.makefile $(filter-out 'test',$(MAKECMDGOALS)); \
	fi

%:
	if [ $(firstword $(MAKECMDGOALS)) == $@ ] && [ $@ != 'test' ] && [ -a $(MAKEFILES_DIR)/$@.makefile ]; then \
		echo 'test' \
		$(MAKE) -f $(MAKEFILES_DIR)/$@.makefile $(filter-out $@,$(MAKECMDGOALS)); \
	fi

.PHONY: % #all targets are phony
