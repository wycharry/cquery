'use strict';

import * as path from 'path';

import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, SettingMonitor, ServerOptions, TransportKind, RevealOutputChannelOn, InitializationFailedHandler, ErrorHandler, ErrorAction, CloseAction } from 'vscode-languageclient';
import { Message } from 'vscode-jsonrpc';

class MyErrorHandler implements ErrorHandler {
    error(error: Error, message: Message, count: number): ErrorAction {
      console.log('!!!! error');
      console.log(error);
      console.log(message);
      console.log(count);
      return ErrorAction.Continue;
    }
    closed(): CloseAction	{
      return CloseAction.DoNotRestart;
    }
}

function parsePosition(p): vscode.Position {
  return new vscode.Position(p.line, p.character);
}
function parseRange(r): vscode.Range {
  return new vscode.Range(parsePosition(r.start), parsePosition(r.end));
}
function parseLocation(l): vscode.Location {
  return new vscode.Location(parseUri(l.uri), parseRange(l.range));
}
function parseLocations(ls): Array<vscode.Location> {
  let parsedLocations = [];
  for (let location of ls)
    parsedLocations.push(parseLocation(location));
  return parsedLocations;
}
function parseUri(u): vscode.Uri {
  return vscode.Uri.parse(u);
}


export function activate(context: vscode.ExtensionContext) {
  /////////////////////////////////////
  // Setup configuration, start server.
  /////////////////////////////////////

  let config = vscode.workspace.getConfiguration('cquery');
  let clientConfig = {
    cacheDirectory: config.get('cacheDirectory'),
    whitelist: config.get('whitelist'),
    blacklist: config.get('blacklist'),
    extraClangArguments: config.get('extraClangArguments'),
    maxWorkspaceSearchResults: config.get('misc.maxWorkspaceSearchResults'),
    indexerCount: config.get('misc.indexerCount'),
    enableIndexing: config.get('misc.enableIndexing'),
    enableCacheWrite: config.get('misc.enableCacheWrite'),
    enableCacheRead: config.get('misc.enableCacheRead')
  }

  if (!clientConfig.cacheDirectory) {
    if (!context.storagePath) {
      vscode.window.showErrorMessage(
          'Could not auto-discover cache directory. Please use "Open Folder" ' +
          'or specify it in the |cquery.cacheDirectory| setting.');
      return;
    }

    console.log('Updating cache directory')
    clientConfig.cacheDirectory = context.storagePath.replace(/\\/g, '/') + "/cquerycache/"
    config.update('cacheDirectory',
                  clientConfig.cacheDirectory,
                  false /*global*/).then(() => {
                    console.log('Updated config cache directory');
                  }, (reason) => {
                    console.log('Cache directory update failed');
                    console.log(reason);
                  });
  }

  let serverOptions: ServerOptions = {
      command: 'indexer.exe', args: ['--language-server'], options: {
      cwd: 'C:/Users/jacob/Desktop/superindex/indexer/x64/Release',
      // env: {
      //   'MALLOC_CHECK_': '2'
      // }
    }
  }

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    documentSelector: ['cpp'],
    // synchronize: {
    // 	configurationSection: 'cquery',
    // 	fileEvents: workspace.createFileSystemWatcher('**/.cc')
    // },
    diagnosticCollectionName: 'cquery',
    outputChannelName: 'cquery',
    revealOutputChannelOn: RevealOutputChannelOn.Error,
    initializationOptions: clientConfig,
    initializationFailedHandler: (e) => {
      console.log(e);
      return false;
    },
    errorHandler: new MyErrorHandler()
  }

  // Create the language client and start the client.
  let languageClient = new LanguageClient('cquery', 'cquery', serverOptions, clientOptions);
  let disposable = languageClient.start();
  context.subscriptions.push(disposable);


  /////////////////////
  // Register commands.
  /////////////////////

  vscode.commands.registerCommand('cquery.freshenIndex', () => {
    languageClient.sendNotification('$cquery/freshenIndex');
  });

  function makeRefHandler(methodName, autoGotoIfSingle = false) {
    return () => {
      let position = vscode.window.activeTextEditor.selection.active;
      let uri = vscode.window.activeTextEditor.document.uri;
      languageClient.sendRequest(methodName, {
        textDocument: { uri: uri.toString(), },
        position: position
      }).then((locations: Array<object>) => {
        if (autoGotoIfSingle && locations.length == 1) {
          let location = parseLocation(locations[0])
          vscode.commands.executeCommand(
            'cquery.goto',
            location.uri, location.range.start, []);
        } else {
          vscode.commands.executeCommand(
            'editor.action.showReferences',
            uri, position, parseLocations(locations));
        }
      })
    }
  }
  vscode.commands.registerCommand('cquery.vars', makeRefHandler('$cquery/vars'));
  vscode.commands.registerCommand('cquery.callers', makeRefHandler('$cquery/callers'));
  vscode.commands.registerCommand('cquery.base', makeRefHandler('$cquery/base', true));
  vscode.commands.registerCommand('cquery.derived', makeRefHandler('$cquery/derived'));

  // The language client does not correctly deserialize arguments, so we have a
  // wrapper command that does it for us.
  vscode.commands.registerCommand('cquery.showReferences', (uri, position, locations) => {
    vscode.commands.executeCommand(
      'editor.action.showReferences',
      parseUri(uri), parsePosition(position), parseLocations(locations));
  });


  vscode.commands.registerCommand('cquery.goto', (uri, position, locations) => {
    let parsedPosition = parsePosition(position);
    let parsedUri = parseUri(uri);

    vscode.workspace.openTextDocument(parsedUri).then(d => {
      if (!d) {
        vscode.window.activeTextEditor.revealRange(new vscode.Range(parsedPosition, parsedPosition), vscode.TextEditorRevealType.InCenter);
        vscode.window.activeTextEditor.selection = new vscode.Selection(parsedPosition, parsedPosition);
      }
      else {
        vscode.window.showTextDocument(d).then(e => {
          e.revealRange(new vscode.Range(parsedPosition, parsedPosition), vscode.TextEditorRevealType.InCenter);
          e.selection = new vscode.Selection(parsedPosition, parsedPosition);
        })
      }
    })
  });


}
