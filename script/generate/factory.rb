require 'rubygems'
require 'bundler/setup'
require 'factory_girl'
require 'mongoid'
require 'database_cleaner'
include FactoryGirl

Mongoid.load!("#{__dir__}/mongoid.yml", :development)

class User
  include Mongoid::Document
  embeds_many :credits
end

class Credit
  include Mongoid::Document
  field :amount, type: Integer
  embeds_one :user
end

FactoryGirl.define do
  sequence :_id do |n|
    "user#{n}@example.com"
  end
  factory :credit do
    amount 10000
    user
  end

  factory :user do
    _id
    transient {credits_count 5}
    after(:create) do |user, evaluator|
      create_list(:credit, evaluator.credits_count, user: user)
    end
  end
end

FactoryGirl.create :user
