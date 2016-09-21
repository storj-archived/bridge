FROM storjlabs/docker-nodejs:4.1.1

# Apt
RUN apt-get update
RUN apt-get install -y git wget curl

# Create directory for the app
RUN mkdir -p /opt/audits
WORKDIR /opt/audits

# Copy over the app and install
COPY . /opt/audits/

# Clean any extra files that got coppied from the host's repo
# Commenting this so we can build something thats not in the upstream repo
#RUN git reset --hard
#RUN git clean -fdx

# Install node modules for production (i.e. don't install devdeps)
RUN npm install --production

# Link the binaries so we can start the service
RUN npm link

# Start the app
#CMD [ "storj-audit-service" ]

# Use for testing
CMD [ "/bin/sleep", "5000" ]
