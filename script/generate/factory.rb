require 'rubygems'
require 'bundler/setup'
require 'factory_girl'
require 'mongoid'
require 'database_cleaner'
require 'date'
include FactoryGirl

Mongoid.load!("#{__dir__}/mongoid.yml", :development)

DatabaseCleaner.strategy = :truncation
DatabaseCleaner.clean

def random_date
  DateTime.now - (Random.rand(1..720)/24.0) #sometime within the last 30 days
end

class User
  include Mongoid::Document
  has_many :credits
  has_many :debits

  field :hashpass, type: String
  field :created, type: DateTime
  field :activated, type: Boolean
end

class Credit
  include Mongoid::Document
  belongs_to :user

  field :amount, type: Integer
  field :created, type: DateTime
end

class Debit
  include Mongoid::Document
  belongs_to :user

  field :amount, type: Integer
  field :created, type: DateTime
end

FactoryGirl.define do
  sequence :_id do |n|
    "user#{n}@example.com"
  end

  sequence :created do
    random_date
  end

  factory :credit do
    amount 10000
    created
    user
  end

  factory :debit do
    amount 10000
    created
    user
  end

  factory :user do
    _id
    hashpass '3f432dff8834d517de9ed5428bad0df117b30894bff4eed4d2d515e4bc48bc7f' #badpassword
    activated true
    created DateTime.now - 35 #35 days ago
    transient {credits_count 4}
    transient {debits_count 5}
    after(:create) do |user, evaluator|
      credits = create_list(:credit, evaluator.credits_count, user: user)
      debits = create_list(:debit, evaluator.debits_count, user: user)
    end
  end
end

FactoryGirl.create :user
