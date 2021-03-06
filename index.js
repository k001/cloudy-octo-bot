var tokens = {
  wit: {
    witToken: process.env.WIT_TOKEN
  },
  slack: {
    slackToken: process.env.SLACK_TOKEN,
    debug: (process.env.DEBUG)? true: false
  },
  sn: {
    instance: process.env.INSTANCE_NAME,
    user: process.env.USERNAME,
    pass: process.env.PASSWORD
  },
  aws: {
    keyId: process.env.ACCESS_KEY_ID,
    accessKey: process.env.ACCESS_KEY,
    role: process.env.ROLE,
    region: (!process.env.REGION)? 'us-east-1': process.env.REGION,
    dynamodb: process.env.TABLE
  },
  attsn:{
    username: process.env.ATTSN_USERNAME,
    password: process.env.ATTSN_PASSWORD,
    hostname: process.env.ATTSN_HOST
  }
};
if (!tokens) {
  console.log('Error: Specify Slack or WIT token in environment');
  process.exit(1);
}

var Botkit = require('botkit');
var Witbot = require('witbot');
var os = require('os');
var fs = require('fs');

var controller = Botkit.slackbot({
  debug: (tokens.slack.debug)? 'debug': 'info',
  logLevel: 'debug',
  json_file_store:  '/tmp/data'
});

var bot = controller.spawn({
  token: tokens.slack.slackToken
}).startRTM(function(err, bot, payload) {
  console.log(payload.team.name);
  for (var u in payload.users) {
    controller.storage.users.save(payload.users[u]);
  }
  for (var c in payload.channels) {
    controller.storage.channels.save(payload.channels[c]);
  }
});

soSorryPhases = function(convo) {
  fs.readFile(__dirname + '/diccionary.txt', 'UTF-8', function(err, contents) {
    try {
      if (err) throw err;
      var text = contents.toString();
      var lines = text.split('\n');
      var words = lines[Math.floor(Math.random() * lines.length)].toString();
      convo.say(words);
      return;
      /*jshint -W002 */
    } catch (err) {
      convo.say("So Sorry my master! :cry:");
    }
  });
};

createTicket = function(response, convo){
  convo.say('Please, just wait a sec...');
  var options = {
    user: tokens.sn.user,
    pass: tokens.sn.pass,
    instance: tokens.sn.instance
  };
  convo.say('...');
  var ServiceNow = require('npm-servicenow')(options);
  var Incident = ServiceNow.Incident;
  var answers = convo.extractResponses();
  var data = {
    description: answers.description,
    short_description: answers.subject,
    assignment_group: 'EADP-Cloud-L3',
    caller_id: answers.email.match(bot.utterances.email)[1],
    u_category: convo.subcategory
  };
  convo.say('...');
  Incident.create(data, function(err, ticket){
    convo.say(":nerd_face: I'm still working on it");
    try {
      if (err) throw err;
      var id = ticket.result.number;
      convo.say("Cool I have finished! :tada:");
      var comment = "_`Here is your magic number:`_ "+ id;
      convo.say(comment);
      return;
    /*jshint -W002 */
    } catch (err) {
      console.log(err);
      /*jshint multistr: true */
      var message = "_*Ups :sadpanda: something happened sorry, try again I \
 know it's not an :rocket: science but sorry :(*_";
      convo.say(message);
      convo.say(err);
    }
  });
};

var witbot = Witbot(tokens.wit.witToken);

bot.utterances.email = new RegExp(/<mailto:([\w?\.?\_?\-?\w]*@.*)\|.*/i);
bot.utterances.cancel = new RegExp(/^cancel/i);

controller.hears(['shutdown'],['direct_message', 'mention', 'direct_mention'],
  function(bot, message) {
    bot.startConversation(message,function(err, convo) {
      convo.ask('Are you sure you want me to shutdown?',[
        {
          pattern: bot.utterances.yes,
          callback: function(response, convo) {
            convo.say('Bye!');
            convo.next();
            setTimeout(function() {
              process.exit();
            },3000);
          }
        },
        {
          pattern: bot.utterances.no,
          default: true,
          callback: function(response, convo) {
            convo.say('*Phew!*');
            convo.next();
          }
        }
      ]);
    });
});
controller.hears(['uptime', 'identify yourself', 'who are you',
  'what is your name'], 'direct_message,direct_mention,mention',
  function(bot, message) {
  var hostname = os.hostname();
  var uptime = formatUptime(process.uptime());
  bot.reply(message, ':robot_face: I am a bot named <@' + bot.identity.name +
    '>. I have been running for `' + uptime + '` on `' + hostname + "`.");
});
controller.hears('.*', ['direct_message', 'direct_mention', 'mention'],
  function(bot, message) {
  witbot.process(message.text, bot, message);
});


witbot.hears('how_are_you', 0.5, function(bot, message, outcome) {
  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'robot_face',
  }, function(err, res) {
    if (err) {
      bot.botkit.log('Failed to add emoji reaction :(', err);
    }
  });
  controller.storage.users.get(message.user, function(err, user) {
    if (user && user.name) {
      bot.reply(message, 'Hello ' + user.real_name + '!!');
    } else {
      bot.reply(message, 'Hello.');
    }
  });
});
witbot.hears('call_me', 0.5, function(bot, message, outcome) {
  if (!outcome.entities.contact || outcome.entities.contact.lenght === 0) {
    bot.reply(message, 'I can remember your name, but I need to know first');
    return;
  }
  var user = {
    id: message.user,
  };
  user.name = outcome.entities.contact[0].value;
  controller.storage.users.save(user, function(err, id) {
    if (err) {
      console.error(err);
      /*jshint multistr: true */
      bot.reply(message, 'Uh oh, there was a problem to remember your name,\
      sorry!');
      return;
    }
    bot.reply(message, 'Got it. I will call you *' + user.name +
      '* from now on.');
  });
});
/*jshint multistr: true */
witbot.hears('help', 0.5, function(bot, message, outcome) {
  var msg = "I can help you to create, check and review `ServiceNOW` \
  :servicenow: and `Amazon Web Services` :aws: tickets\n\
  But in the mean time, could you please tell me your name or How you want \
  to call you?\n\
  _`Ex:`_\n\
  • `My name is Cloud OPIE.`\n\
  • `Call me Cloud OPIE`.\n\
  • `Open ticket support.` \n\
  • `I can tell you about your documentation in EADPSE, ask me:` \n \t \
  \t _`Ex:`_\n \t \
  • `What is our Standards Security Groups` \n \t \
  • `Who` or `What is Ultraviolet` \n \t \
  • `Search for Lambda functions` \n \t \
  • `How do Virtualization`";
  bot.reply(message, msg);
});
witbot.hears('tickets', 0.5, function(bot, message, outcome) {
  bot.startConversation(message, askToCreateTicket);
});
witbot.hears('access', 0.5, function(bot, message, outcome){
  console.log(outcome.entities);
  if (!outcome.entities.acct || outcome.entities.acct.lenght === 0) {
    bot.reply(message, "Sorry number or account name it's required");
    return;
  }
  var capture_options = {
    key: 'account',
    multiple: false
  };
  bot.startConversation(message, function(response, convo){
    convo.ask("*_• Are you sure to request access to the Account:_* "+
      outcome.entities.acct[0].value, [{
      pattern: bot.utterances.yes,
      callback: function(response, convo){
        convo.say("_`Requesting access to the Account Manager`_");
        convo.account = outcome.entities.acct[0].value;
        awsContactingManager(response, convo);
        convo.next();
      }
      }, {
        pattern: bot.utterances.no,
        default: true,
        callback: function(response, convo) {
          convo.say('*Phew!*');
          convo.next();
        }
      }, {
        pattern: bot.utterances.cancel,
        callback: function(response, convo) {
          convo.say('*Phew!*');
          convo.next();
        }
    }], capture_options);
  });
});

witbot.hears('search', 0.5, function(bot, message, outcome){
  if (!outcome.entities.search_query || outcome.entities.search_query.lenght === 0) {
    bot.reply(message, 'Ups nothing found!');
    return;
  }
  var term = outcome.entities.search_query[0].value;
  var Client  = require('node-rest-client').Client;
  var options_auth = {user: tokens.attsn.username, password: tokens.attsn.password};
  var client = new Client(options_auth);
  var host = 'https://'+tokens.attsn.hostname;
  client.get(host+"/rest/api/content/search?cql=type=page%20and%20space=EADPSE%20and\
    %20text%20~%22"+term+"%22%20or%20title~%22"+term+"%22&limit=5", function(data, response){
    bot.reply(message, "Sure, I'm searching `"+ term +"` :nerd_face:");
    if(data.results.length <= 0) {
      bot.startConversation(message, function(response, convo, outcome){
        soSorryPhases(convo);
        convo.say("Ups nothing found!");
      });
      return;
    }
    bot.reply(message, '...');
    data.results.forEach(function(elem, array, index){
      var reply_with_attachments = {
          'attachments': [
            {
              'color': '#7CD197',
              'fallback' : '<'+host+elem._links.tinyui+'|'+host+elem._links.tinyui,
              'title': '...'+elem._links.webui,
              'title_link': host+elem._links.tinyui
            }
          ]
      };
      bot.reply(message, reply_with_attachments);
    });
  }).on('error', function(err){
    bot.reply(message, "`Sorry, at the moment, I cannot connect to Atlassian, please try later` :-1::skin-tone-3: :sadpanda:");
  });
});
witbot.otherwise(function(bot, message) {
  var smartbot = "I’m a smart bot, but I’m still learning how to interact with\
  humans :thinking_face:.\n \
  Please type `help` to get some assistance and see the most popular commands.";
  bot.reply(message, smartbot);
});

askRequestAccess = function(response, convo, outcome){

};

awsContactingManager = function(response, convo) {
  var accountId = convo.account;
  console.log(accountId);
  var AWS = require('aws-sdk');
  AWS.config = new AWS.Config({
      accessKeyId:tokens.aws.keyId,
      secretAccessKey: tokens.aws.accessKey,
      region: tokens.aws.region
  });
  var docClient = new AWS.DynamoDB.DocumentClient();
  var params = {
    Key: {
      id: accountId.toString()
    },
    TableName: tokens.aws.dynamodb,
    AttributesToGet: [
      'manager',
      'emails'
    ]
  };
  docClient.get(params, function(err, data){
    if(err){
      soSorryPhases(convo);
      convo.say("The account request not found!");
      console.log(JSON.stringify(err, null, 2));
    }
    else{
      console.log("Query succeeded.");
      data.Item.forEach(function(item) {
        console.log(" - Manager", item.manager[1]);
      });
    }
  });
  return;
};

askToCreateTicket = function(response, convo) {
  var capture_options = {
    key: 'kindOfTicket',
    multiple: false
  };
  convo.sayFirst('_Tip_: _Each time you can terminate the conversation with \
  `Cancel`_');
  convo.ask("_• Would you like to open a ticket with `ServiceNOW` :servicenow: \
  or  `Amazon Web Services` :aws:?_\n\
  _`No`_  |  _`Cancel`_", [{
    pattern: /ea|servicenow|electronic arts/i,
    callback: function(response, convo) {
      convo.say('_*I will open a* `ServiceNOW` :servicenow: *ticket for\
  EADP-Cloud-L3.*_');
      askEARequestorEmail(response, convo);
      convo.next();
    }
  }, {
    pattern: /aws|amazon|cloud|amazon web services/i,
    callback: function(response, convo) {
      convo.say('_*I will open an Amazon Web Services :aws: support ticket.*_');
      askAWSAccount(response, convo);
      convo.next();
    }
  }, {
    pattern: bot.utterances.cancel,
    callback: function(response, convo) {
      soSorryPhases(convo);
      convo.next();
    }
  }, {
    pattern: bot.utterances.no,
    callback: function(response, convo) {
      soSorryPhases(convo);
      convo.next();
    }
  }, {
    default: true,
    callback: function(response, convo) {
      convo.repeat();
      convo.next();
    }
  }], capture_options);
};
askAWSAccount = function(response, convo) {
  /*  We need add expansion check the Account Id With CIA*/
  var capture_options = {
    key: 'account',
    multiple: false
  };
  convo.ask("_• What AWS account are you opening this ticket for?_", [{
    pattern: bot.utterances.no,
    callback: function(response, conv){
      convo.next();
    }
  }, {
    pattern: bot.utterances.cancel,
    callback: function(response, convo) {
      soSorryPhases(convo);
      convo.next();
    }
  }, {
    default: true,
    callback: function(response, convo) {
      convo.say('_*`Please, I need a valid email address`*_');
      convo.repeat();
      convo.next();
    }
  }], capture_options);
};

askEARequestorEmail = function(response, convo) {
  var capture_options = {
    key: 'email',
    multiple: false
  };
  convo.ask("_• What is the email address for the ticket requestor?_", [{
    pattern: bot.utterances.email,
    callback: function(response, convo) {
      convo.say("_*Noted*_");
      askEACategory(response, convo);
      convo.next();
    }
  }, {
    pattern: bot.utterances.cancel,
    callback: function(response, convo) {
      soSorryPhases(convo);
      convo.next();
    }
  }, {
    default: true,
    callback: function(response, convo) {
      convo.say('_*`Please, I need a valid email address`*_');
      convo.repeat();
      convo.next();
    }
  }], capture_options);
};
/*jshint multistr: true */
askEACategory = function(response, convo) {
  var capture_options = {
    key: 'category',
    multiple: false
  };
  convo.say("_`Select one of the next numeric List.`_");
  convo.ask("_• What category would you like to open a ticket for?_\n\
    _`Ex:`_ \n\
      1. `Access` \n\
      2. `Functional` \n\
      3. `General Questions` \n\
      4. `Performance`", [
  {
    pattern: /^1$/i,
    callback: function(response, convo) {
      var capture_options = {
        key: 'subcategory',
        multiple: false
      };
      var uno = 'Access > Cannot connect';
      var dos = 'Access > Connection refused';
      var tres = 'Access > Login not recognized';
      var cuatro = 'Access > Other';
      var cinco = 'Access > Redirected unexpectedly';
      var message_string = "1. `" + uno + "` \n\ 2. `" + dos + "` \n\ 3. `" +
      tres + "` \n\ 4. `" + cuatro + "` \n\ 5. `" + cinco + "`";
      convo.say("_`Select one of the next numeric List.`_");
      convo.ask(message_string, [{
        pattern: /^1$/i,
        callback: function(response, convo) {
          convo.say("_Selected: `" + uno + "`_");
          convo.subcategory = uno;
          console.log(convo.subcategory);
          askEABriefSummary(response, convo);
          convo.next();
        }
      }, {
        pattern: /^2$/i,
        callback: function(response, convo) {
          convo.say("_Selected: `" + dos + "`_");
          convo.subcategory = dos;
          askEABriefSummary(response, convo);
          convo.next();
        }
      }, {
        pattern: /^3$/i,
        callback: function(response, convo) {
          convo.say("_Selected: `" + tres + "`_");
          convo.subcategory = tres;
          askEABriefSummary(response, convo);
          convo.next();
        }
      }, {
        pattern: /^4$/i,
        callback: function(response, convo) {
          convo.say("_Selected: `" + cuatro + "`_");
          convo.subcategory = cuatro;
          askEABriefSummary(response, convo);
          convo.next();
        }
      }, {
        pattern: /^5$/i,
        callback: function(response, convo) {
          convo.say("_Selected: `" + cinco + "`_");
          convo.subcategory = cinco;
          askEABriefSummary(response, convo);
          convo.next();
        }
      }, {
        pattern: bot.utterances.cancel,
        callback: function(response, convo) {
          soSorryPhases(convo);
          convo.next();
        }
      }, {
        default: true,
        callback: function(response, convo) {
          convo.say('_*`Please, I need a option selected`*_');
          convo.repeat();
          convo.next();
        }
      }], capture_options);
      convo.next();
    }
  }, {
    pattern: /^2$/i,
    callback: function(response, convo) {
      var capture_options = {
        key: 'subcategory',
        multiple: false
      };
      var uno = 'Functional > Insufficient capacity';
      var dos = 'Functional > Insufficient permissions';
      var tres = 'Functional > Other';
      var cuatro = 'Functional > Unable to perform required action';
      var message_string = "1. `" + uno + "` \n\ 2. `" + dos + "` \n\ 3. `" +
      tres + "` \n\ 4. `" + cuatro + "`";
      convo.say("_`Select one of the next numeric List.`_");
      convo.ask(message_string, [{
        pattern: /^1$/i,
        callback: function(response, convo) {
          convo.say("_Selected: `" + uno + "`_");
          convo.subcategory = uno;
          askEABriefSummary(response, convo);
          convo.next();
        }
      }, {
        pattern: /^2$/i,
        callback: function(response, convo) {
          convo.say("_Selected: `" + dos + "`_");
          convo.subcategory = dos;
          askEABriefSummary(response, convo);
          convo.next();
        }
      }, {
        pattern: /^3$/i,
        callback: function(response, convo) {
          convo.say("_Selected: `" + tres + "`_");
          convo.subcategory = tres;
          askEABriefSummary(response, convo);
          convo.next();
        }
      }, {
        pattern: /^4$/i,
        callback: function(response, convo) {
          convo.say("_Selected: `" + cuatro + "`_");
          convo.subcategory = cuatro;
          askEABriefSummary(response, convo);
          convo.next();
        }
      }, {
        pattern: bot.utterances.cancel,
        callback: function(response, convo) {
          soSorryPhases(convo);
          convo.next();
        }
      }, {
        default: true,
        callback: function(response, convo) {
          convo.say('_*`Please, I need a option selected`*_');
          convo.repeat();
          convo.next();
        }
      }], capture_options);
      convo.next();
    }
  }, {
    pattern: /^3$/i,
    callback: function(response, convo) {
      var capture_options = {
        key: 'subcategory',
        multiple: false
      };
      var uno = 'General Questions > How do I...';
      var dos = 'General Questions > Where is...';
      var message_string = "1. `" + uno + "` \n\ 2. `" + dos + "`";
      convo.say("_`Select one of the next numeric List.`_");
      convo.ask(message_string, [{
        pattern: /^1$/i,
        callback: function(response, convo) {
          convo.say("_Selected: `" + uno + "`_");
          convo.subcategory = uno;
          console.log(convo.subcategory);
          askEABriefSummary(response, convo);
          convo.next();
        }
      }, {
        pattern: /^2$/i,
        callback: function(response, convo) {
          convo.say("_Selected: `" + dos + "`_");
          convo.subcategory = dos;
          askEABriefSummary(response, convo);
          convo.next();
        }
      }, {
        pattern: bot.utterances.cancel,
        callback: function(response, convo) {
          soSorryPhases(convo);
          convo.next();
        }
      }, {
        default: true,
        callback: function(response, convo) {
          convo.say('_*`Please, I need a option selected`*_');
          convo.repeat();
          convo.next();
        }
      }], capture_options);
      convo.next();
    }
  }, {
    pattern: /^4$/i,
    callback: function(response, convo) {
      var capture_options = {
        key: 'subcategory',
        multiple: false
      };
      var uno = 'Performance > Frequent crashes';
      var dos = 'Performance > Frequent drops';
      var tres = 'Performance > Other';
      var cuatro = 'Performance > Slow response';
      var cinco = 'Performance > System unavailable';
      var message_string = "1. `" + uno + "` \n\ 2. `" + dos + "` \n\ 3. `" +
      tres + "` \n\ 4. `" + cuatro + "` \n\ 5. `" + cinco + "`";
      convo.say("_`Select one of the next numeric List.`_");
      convo.ask(message_string, [{
        pattern: /^1$/i,
        callback: function(response, convo) {
          convo.say("_Selected: `" + uno + "`_");
          convo.subcategory = uno;
          console.log(convo.subcategory);
          askEABriefSummary(response, convo);
          convo.next();
        }
      }, {
        pattern: /^2$/i,
        callback: function(response, convo) {
          convo.say("_Selected: `" + dos + "`_");
          convo.subcategory = dos;
          askEABriefSummary(response, convo);
          convo.next();
        }
      }, {
        pattern: /^3$/i,
        callback: function(response, convo) {
          convo.say("_Selected: `" + tres + "`_");
          convo.subcategory = tres;
          askEABriefSummary(response, convo);
          convo.next();
        }
      }, {
        pattern: /^4$/i,
        callback: function(response, convo) {
          convo.say("_Selected: `" + cuatro + "`_");
          convo.subcategory = cuatro;
          askEABriefSummary(response, convo);
          convo.next();
        }
      }, {
        pattern: /^5$/i,
        callback: function(response, convo) {
          convo.say("_Selected: `" + cinco + "`_");
          convo.subcategory = cinco;
          askEABriefSummary(response, convo);
          convo.next();
        }
      }, {
        pattern: bot.utterances.cancel,
        callback: function(response, convo) {
          soSorryPhases(convo);
          convo.next();
        }
      }, {
        default: true,
        callback: function(response, convo) {
          convo.say('_*`Please, I need a option selected`*_');
          convo.repeat();
          convo.next();
        }
      }], capture_options);
      convo.next();
    }
  }, {
    pattern: bot.utterances.cancel,
    callback: function(response, convo) {
      soSorryPhases(convo);
      convo.next();
    }
  }, {
    default: true,
    callback: function(response, convo) {
      convo.say('_*`Please, Select a valid option`*_');
      convo.repeat();
      convo.next();
    }
  }], capture_options);
};
askEABriefSummary = function(response, convo) {
  var capture_options = {
    key: 'subject',
    multiple: false
  };
  convo.ask("_• Tell me a brief subject to describe the support ticket: _", [{
    pattern: bot.utterances.cancel,
    callback: function(response, convo) {
      soSorryPhases(convo);
      convo.next();
    }
  }, {
    pattern: bot.utterances.no,
    callback: function(response, convo) {
      soSorryPhases(convo);
      convo.next();
    }
  }, {
    default: true,
    callback: function(response, convo) {
      convo.say("_*Noted*_");
      askEADescription(response, convo);
      convo.next();
    }
  }], capture_options);
};
askEADescription = function(response, convo) {
  var capture_options = {
    key: 'description',
    multiple: false
  };
  convo.ask("_• Can you describe the issue further for the description?_", [{
    pattern: bot.utterances.cancel,
    callback: function(response, convo) {
      soSorryPhases(convo);
      convo.next();
    }
  }, {
    pattern: bot.utterances.no,
    callback: function(response, convo) {
      soSorryPhases(convo);
      convo.next();
    }
  }, {
    default: true,
    callback: function(response, convo) {
      convo.say("_*Noted*_");
      convo.say('_*Ok, Trying to create*_');
      createTicket(response, convo);
      convo.next();
    }
  }], capture_options);
};

/*
function getAccountsId(callback) {
   // Retrieving accounts from CIA

    var dynamodb = new AWS.DynamoDB();

    dynamodb.scan({TableName: 'accounts'}, function(err, data){
        if (err) {
        return callback(err);
                }
        var ids = data.Items.map(function(item) {return item.id.S; });
        return callback(null, ids);
    });
}*/

assumeRole = function(account, callback) {
  var accountId = account.id;
  var params = {
    RoleArn: 'arn:aws:iam::' + accountId + ':role/' + role,
    RoleSessionName: role + '-' + accountId
  };
  sts.assumeRole(params, function(err, data) {
    if (err) {
      return callback(err);
    }
    creds = data.Credentials;
    var params = {
      accessKeyId: creds.AccessKeyId,
      secretAccessKey: creds.SecretAccessKey,
      sessionToken: creds.SessionToken
    };
    account.creds = creds;
    account.support = new AWS.Support(params);
    var iam = new AWS.IAM(params);
    iam.listAccountAliases(function(err, data) {
      if (err) {
        return callback(err);
      }
      account.alias = data.AccountAliases[0];
      return callback(null, account);
    });
  });
};

function formatUptime(uptime) {
  var unit = 'second';
  if (uptime > 60) {
    uptime = uptime / 60;
    unit = 'minute';
  }
  if (uptime > 60) {
    uptime = uptime / 60;
    unit = 'hour';
  }
  if (uptime != 1) {
    unit = unit + 's';
  }

  uptime = Math.round(uptime) + ' ' + unit;
  return uptime;
}
