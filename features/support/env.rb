# Configure the load path so all dependencies in the Gemfile can be required
require 'rubygems'
require 'bundler/setup'

require 'rspec/expectations'
require 'mongoid'
require 'database_cleaner'
require 'factory_girl'
require 'RestClient'

# Require files in ./helpers recursively
Dir["#{__dir__}/helpers/*{,*/*}"].each {|file| require file}

require "#{__dir__}/../../script/generate/factory"

include RSpec::Expectations
include Helpers
include FactoryGirl::Syntax::Methods

# TODO: reference `ENV['DATABASE_URL']` instead
#Mongoid.load!("#{__dir__}/mongoid.yml", :test)
DatabaseCleaner[:mongoid].strategy = :truncation

Before do
  DatabaseCleaner.clean
end
