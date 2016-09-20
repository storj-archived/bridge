.SILENT:
.DEFAULT:

MAKEFILES_DIR = makefiles
target = $@

help:
	if [ $(words $(MAKECMDGOALS)) -eq 1 ]; then \
		echo 'Run `make <command> help` for more specific help' | fold -s; \
		echo ''; \
		echo 'commands:'; \
		for file in $(wildcard $(MAKEFILES_DIR)/*); do \
			echo "	`$(MAKE) -f $$file shortdesc`"; \
		done \
	fi

%:
	if [ -a $(MAKEFILES_DIR)/$@.makefile ]; then \
		$(MAKE) -f $(MAKEFILES_DIR)/$@.makefile $(filter-out $@,$(MAKECMDGOALS)); \
	fi;

.PHONY: % #all targets are phony
