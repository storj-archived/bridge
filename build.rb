#!/usr/bin/env ruby

# This script is for doing things like...
# - Building docker containers for development and production
# - Building base docker images on top of which the app container is built
# - Running tests in docker enabling us to run tests in a production like environment

require 'optparse'
require 'json'
require 'pp'
require 'fileutils'
require 'pathname'
require 'highline/import'

include FileUtils

options = {}
defaults = {}

ARGV << '-h' if ARGV.empty?

OptionParser.new do |opts|
  opts.banner = "Usage: build [options]"

  # Configure default options
  defaults[:environment] = 'development'

  # Setup
  opts.separator ''
  opts.separator 'Setup'

  opts.on('-s', '--setup', 'Set up local environment for building and working with docker images') { |v| options[:setup] = true }

  # Building
  opts.separator ''
  opts.separator "Actions"

  opts.on('-b', '--build', 'Build a docker image') { |v| options[:build] = true }
  opts.on('-r [MODE]', '--run', 'Run a development instance',
          '   Run modes: (* = default)',
          '     * local - run all services locally',
          '       hybrid - run app container locally and use remote dependencies',
          '       deps - run the dependencies container for troubleshooting',
          '       os - run the os container for troubleshooting') do |mode|
            options[:run] = mode || 'local'
          end
  opts.on('-p', '--push', 'Push a docker image for an application to the docker hub') { |v| options[:push] = true }

  opts.separator ''
  opts.separator "To build, run, or push  you must choose either an environment to build the application for"
  opts.on('-e', '--environment', 'Environment for which we are building our application') { |v| options[:build] = v }
  opts.on('-o', '--os', 'Build the base OS docker image') { |v| options[:os] = true }
  opts.on('-d', '--deps', 'Build the dependencies docker image') { |v| options[:deps] = true }
  opts.on('-a [APP NAME]', '--app', 'Build application container') { |v| options[:app] = v }
  opts.on('-A', '--all', 'Build all images. Defaults to development environment') { |v| options[:all] = true }


  # Testing
  opts.separator ''
  opts.separator 'Testing'

  opts.on('-t', '--test', 'Run tests in the app docker container') { |v| options[:test] = true }

  opts.separator 'Global Options'
  opts.on('-y', '--yes', 'Do not prompt to confirm any actions') { |v| options[:yes] = true }

  opts.on_tail('-h', '--help', 'Show this message') do
    puts opts
    exit
  end
end.parse!

def yesno(prompt = 'Continue?', default = true)
  a = ''
  s = default ? '[Y/n]' : '[y/N]'
  d = default ? 'y' : 'n'
  until %w[y n].include? a
    a = ask("#{prompt} #{s} ") { |q| q.limit = 1; q.case = :downcase }
    a = d if a.length == 0
  end
  a == 'y'
end

# Run a system command with real time output
def run_command(intent, command = '')
  confirm = true

  # If an intent is not specified, do not confirm
  if command == '' && intent
    command = intent
    confirm = false
  end

  if confirm
    response = yesno("Are you sure you want to #{intent}?");
    if !response then abort "Aborting..." end
  end

  output = []
  r, io = IO.pipe
  fork do
    system(command, out: io, err: :out)
  end
  io.close
  r.each_line{|l| puts l; output << l.chomp}
  p output
end

def get_nodejs_project_version()
  package_file = File.read('package.json')
  package_data = JSON.parse(package_file)
  package_version = package_data['version']
  return package_version
end

if options[:setup]
  # Determine the OS we're working with

  # Check to see if docker is already installed

  # If not, install docker

  # Download the latest docker for mac image
  docker_dmg_url = "https://download.docker.com/mac/stable/Docker.dmg"
  docker_dmg_file = "Docker.dmg"
  download_path = "/tmp/#{docker_dmg_file}"

  result = `wget -O #{download_path} #{docker_dmg_url}`

  # Mount the dmg
  mount_point = Pathname.new "/Volumes/#{docker_dmg_file}"
  result = `hdiutil attach -mountpoint #{mount_point} #{download_path}`

  # Find the app in the mounted dmg
  files = mount_point.entries.collect { |file| mount_point+file }
  files.reject! { |file| ((file.to_s.include?(".app")) ? false : true) }

  # Copy the app to Applications folder
  files.each { |app|
    # Make sure the app doesn't already exist. If it does, prompt to overwrite/upgrade
    if FileTest.exist?("/Applications/#{app}")
      puts "It appears you already have #{app} installed. What shall we do?"
      puts yesno("Overwrite existing application?");
    end

    puts "Copying #{app} to Applications folder"
    `cp -a #{app} /tmp/Applications/`
  }

  # Unmount the dmg
  puts "Unmounting #{docker_dmg_file}"
  result = `hdiutil detach #{mount_point}`
  puts "Finished installing #{docker_dmg_file}"

  # Clean up after ourselves
  rm docker_dmg_file
end

if options[:build]
  environment = options[:environment]  || 'prod'

  if options[:os]
    run_command('build a new os base image', 'docker build -t storjlabs/deps-os:1 -t storjlabs/deps-os:latest -f ./dockerfiles/os.base.dockerfile .')
  end

  if options[:deps]
    run_command('build a new dependencies base image', 'docker build -t storjlabs/deps-base:1 -t storjlabs/deps-base:latest -f ./dockerfiles/deps.base.dockerfile .')
  end

  if options[:app]
    app_name = options[:app]
    app_version = get_nodejs_project_version()

    run_command('build a new app image', "docker build -t storjlabs/#{app_name}:#{app_version} -t storjlabs/#{app_name}:latest -f ./dockerfiles/#{app_name}.dockerfile .")
  end

  # If no environment, os or deps selected, notify the user that they should choose one
end

if options[:run]
  puts "Run: #{options[:run]}"
  if options[:run] == 'local'
    puts "Running local"
    run_command("docker run storjlabs/#{app_name}:latest")
  end
end

if options[:push]
  version = options[:versin] || 'latest'
  app_name = options[:app]
  image_name = "storjlabs/#{app_name}:#{version}"
  puts "Pushing image '#{image_name}' to the docker hub"

  run_command("docker push #{image_name}")
end
