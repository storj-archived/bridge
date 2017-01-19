FROM ubuntu:16.04

# Update base packages to make sure we have the latest security updates
RUN apt-get update && apt-get upgrade -y && apt-get install -y wget curl net-tools vim
