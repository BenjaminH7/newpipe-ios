// Port quasi verbatim de po_token.html (NewPipe app repo,
// app/src/main/assets/po_token.html) : le bootstrap qui sait charger et
// exécuter la machine virtuelle BotGuard de Google, puis en extraire un
// poToken. Seul ajout par rapport à l'original : exposer explicitement les
// fonctions sur l'objet global, car ici elles sont injectées à l'intérieur
// d'une IIFE (voir jsEngine.ts) au lieu d'être au niveau racine d'une page.
export const BOTGUARD_BOOTSTRAP_SCRIPT = `
function loadBotGuard(challengeData) {
  this.vm = this[challengeData.globalName];
  this.program = challengeData.program;
  this.vmFunctions = {};
  this.syncSnapshotFunction = null;

  if (!this.vm)
    throw new Error('[BotGuardClient]: VM not found in the global object');

  if (!this.vm.a)
    throw new Error('[BotGuardClient]: Could not load program');

  const vmFunctionsCallback = function (
    asyncSnapshotFunction,
    shutdownFunction,
    passEventFunction,
    checkCameraFunction
  ) {
    this.vmFunctions = {
      asyncSnapshotFunction: asyncSnapshotFunction,
      shutdownFunction: shutdownFunction,
      passEventFunction: passEventFunction,
      checkCameraFunction: checkCameraFunction
    };
  };

  this.syncSnapshotFunction = this.vm.a(this.program, vmFunctionsCallback, true, this.userInteractionElement, function () {}, [ [], [] ])[0]

  return new Promise(function (resolve, reject) {
    var i = 0
    var refreshIntervalId = setInterval(function () {
      if (!!this.vmFunctions.asyncSnapshotFunction) {
        resolve(this)
        clearInterval(refreshIntervalId);
      }
      if (i >= 10000) {
        reject("asyncSnapshotFunction is null even after 10 seconds")
        clearInterval(refreshIntervalId);
      }
      i += 1;
    }, 1);
  })
}

function snapshot(args) {
  return new Promise(function (resolve, reject) {
    if (!this.vmFunctions.asyncSnapshotFunction)
      return reject(new Error('[BotGuardClient]: Async snapshot function not found'));

    this.vmFunctions.asyncSnapshotFunction(function (response) { resolve(response) }, [
      args.contentBinding,
      args.signedTimestamp,
      args.webPoSignalOutput,
      args.skipPrivacyBuffer
    ]);
  });
}

function runBotGuard(challengeData) {
  const interpreterJavascript = challengeData.interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue;

  if (interpreterJavascript) {
    new Function(interpreterJavascript)();
  } else throw new Error('Could not load VM');

  const webPoSignalOutput = [];
  return loadBotGuard({
    globalName: challengeData.globalName,
    globalObj: this,
    program: challengeData.program
  }).then(function (botguard) {
    return botguard.snapshot({ webPoSignalOutput: webPoSignalOutput })
  }).then(function (botguardResponse) {
    return { webPoSignalOutput: webPoSignalOutput, botguardResponse: botguardResponse }
  })
}

function obtainPoToken(webPoSignalOutput, integrityToken, identifier) {
  const getMinter = webPoSignalOutput[0];

  if (!getMinter)
    throw new Error('PMD:Undefined');

  const mintCallback = getMinter(integrityToken);

  if (!(mintCallback instanceof Function))
    throw new Error('APF:Failed');

  const result = mintCallback(identifier);

  if (!result)
    throw new Error('YNJ:Undefined');

  if (!(result instanceof Uint8Array))
    throw new Error('ODM:Invalid');

  return result;
}

this.loadBotGuard = loadBotGuard;
this.snapshot = snapshot;
this.runBotGuard = runBotGuard;
this.obtainPoToken = obtainPoToken;
return true;
`;
