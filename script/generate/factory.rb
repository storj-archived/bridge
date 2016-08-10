require 'rubygems'
require 'bundler/setup'
require 'factory_girl'
require 'mongoid'
require 'database_cleaner'
include FactoryGirl

Mongoid.load!("#{__dir__}/mongoid.yml", :development)

DatabaseCleaner.strategy = :truncation
DatabaseCleaner.clean

class User
  include Mongoid::Document
  has_many :credits
  has_many :debits
end

class Credit
  include Mongoid::Document
  field :amount, type: Integer
  belongs_to :user
end

class Debit
  include Mongoid::Document
  field :amount, type: Integer
  belongs_to :user
end

# user = User.create _id: "lott.dylan@gmail.com"
#
# 5.times do |i|
#   credit = Credit.create amount: 10000 + i, user: user
# end
#
# puts(user.credits)

FactoryGirl.define do
  sequence :_id do |n|
    "user#{n}@example.com"
  end
  factory :credit do
    amount 10000
    user
  end

  factory :debit do
    amount 10000
    user
  end

  factory :user do
    _id
    transient {credits_count 4}
    transient {debits_count 5}
    after(:create) do |user, evaluator|
      credits = create_list(:credit, evaluator.credits_count, user: user)
      debits = create_list(:debit, evaluator.debits_count, user: user)
    end
  end
end

FactoryGirl.create :user
