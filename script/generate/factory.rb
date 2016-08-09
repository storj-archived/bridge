require_relative '../../gems/ruby/2.2.0/gems/factory_girl'
include FactoryGirl
require 'mongoid'
require 'database_cleaner'

Mongoid.load!("#{__dir}/mongoid.yml", :development)

class User
  include Mongoid::Document
end

define do
  sequence :email do |n|
    "user#{n}@example.com"
  end
  # factory :credit do
  #   amount 10000
  #   user
  # end

  factory :user do
    _id "test@example.com"
    # credits
  end
end

create :user
