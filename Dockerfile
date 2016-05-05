FROM debian:jessie

# Create directory for the app
RUN mkdir -p /opt/bridge
RUN mkdir -p /root/.storj-bridge/config
WORKDIR /opt/bridge

# Copy over the app and install
COPY . /opt/bridge/
#COPY ./build/config/bridge_config /opt/bridge/.storj-bridge/config/production
RUN /opt/bridge/build/scripts/install_deps_debian.sh
# Need to clean node_modules dir here or exclude it
RUN npm install

# Expose listen port
EXPOSE 8080 80 111 8080 443 8443

# Start the app
#CMD [ "npm", "run", "start-prod" ]

# Use for testing
CMD [ "/bin/sleep", "5000" ]
