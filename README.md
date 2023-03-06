# PowerSchool for NodeRED

A set of nodes which connect to and interact with the PowerSchool API.

## Installation

`npm install @tesd/node-red-contrib-powerschool`

## Quick Start

You will need valid client credentials for the PowerSchool server you would like to connect to. See the PowerSchool Developer Site (https://support.powerschool.com/developer) for information regarding credentials and access permissions.

## Usage

Add a PS Token node and configure the connection settings. This adds the attribute "ps_token" to the message which contains the OAuth token needed to request or update data via the PowerSchool API.

## Implemented Nodes

* PS Token - Generate a new PowerSchool API Token
* PS Request - Send an authenticated request to the PowerSchool API
