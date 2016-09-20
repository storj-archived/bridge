FROM ruby
RUN apt-get update && apt-get install -y build-essential
RUN mkdir /bridge
WORKDIR /bridge

ADD ./Gemfile /bridge/Gemfile
ADD ./Gemfile.lock /bridge/Gemfile.lock

RUN bundle install
