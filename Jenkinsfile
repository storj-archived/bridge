node('node') {
  try {

    stage 'Checkout'

      checkout scm

    stage 'Test'

      sh """#!/bin/bash -e
        source '/var/lib/jenkins/.nvm/nvm.sh'
        node -v
        git clean -fdx
        npm install
        npm test
      """

    stage 'Build Docker'

      sh "git rev-parse --short HEAD > .git/commit-id"
      def commit_id = readFile('.git/commit-id').trim()
      sh "./dockerfiles/build-bridge.sh storjlabs/bridge:${env.BUILD_ID} storjlabs/bridge:${commit_id} storjlabs/bridge:latest"
      sh "./dockerfiles/build-storj-monitor.sh storjlabs/storj-monitor:${env.BUILD_ID} storjlabs/storj-monitor:${commit_id} storjlabs/storj-monitor:latest"
      sh "./dockerfiles/push.sh storjlabs/bridge:${env.BUILD_ID} storjlabs/bridge:${commit_id} storjlabs/bridge:latest"
      sh "./dockerfiles/push.sh storjlabs/storj-monitor:${env.BUILD_ID} storjlabs/storj-monitor:${commit_id} storjlabs/storj-monitor:latest"

    stage 'Deploy'

    /* This should only deploy to staging if the branch is master */
      if (env.BRANCH_NAME == "master") {
        echo 'Push to Repo'
        sh "./dockerfiles/deploy.staging.sh bridge-api storjlabs/bridge:${commit_id}"
        sh "./dockerfiles/deploy.staging.sh storj-monitor storjlabs/storj-monitor:${commit_id}"
      }

    stage 'Cleanup'

      echo 'prune and cleanup'
      sh """#!/bin/bash -e
        source '/var/lib/jenkins/.nvm/nvm.sh'
        rm node_modules -rf
      """

      /*
      mail body: 'project build successful',
        from: 'build@storj.io',
        replyTo: 'build@storj.io',
        subject: 'project build successful',
        to: "${env.CHANGE_AUTHOR_EMAIL}"
      */

  }

  catch (err) {
    currentBuild.result = "FAILURE"

    /*
    mail body: "project build error is here: ${env.BUILD_URL}" ,
      from: 'build@storj.io',
      replyTo: 'build@storj.io',
      subject: 'project build failed',
      to: "${env.CHANGE_AUTHOR_EMAIL}"

      throw err
    */
  }
}
