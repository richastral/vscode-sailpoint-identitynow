import * as vscode from 'vscode';
import { URL_PREFIX } from '../constants';
import { RulesTreeItem, TransformsTreeItem } from '../models/IdentityNowTreeItem';
import { IdentityNowClient } from '../services/IdentityNowClient';
import { getIdByUri, getResourceTypeByUri, getResourceUri } from '../utils/UriUtils';
import * as commands from './constants';


export async function onFileSaved(document: vscode.TextDocument) {
    console.log("> onFileSaved", document);
    if (document.uri.scheme !== URL_PREFIX) {
        return;
    }

    if (!document.uri.path.match(/transforms|connector-rules/)) {
        return;
    }

    const olduri = document.uri;
    const tenantName = olduri.authority;
    // Refresh tree
    let node: any;
    let resourceType: string;
    let isBeta = false;

    if (olduri.path.match('transforms')) {
        node = new TransformsTreeItem(tenantName);
        resourceType = 'transforms';
    } else {
        node = new RulesTreeItem(tenantName);
        resourceType = 'connector-rules';
        isBeta = true;
    }

    vscode.commands.executeCommand(commands.REFRESH, node);

    //////////////////////////////////////////
    // Get generated object to get the ID
    //////////////////////////////////////////
    const client = new IdentityNowClient(tenantName);

    // 1. Get name
    const editorText = document.getText();
    const editorObject = JSON.parse(editorText);
    const name = editorObject.name;
    if (!name) {
        console.log('WARNING onFileSaved: no name');
        return;
    }
    console.log('onFileSaved: name = ', name);

    // 2. Get transform to get ID
    // As it is a "search", an array should be returned
    let data: any;
    if (resourceType === 'transforms') {
        data = await client.getTransformByName(name);
    } else {
        data = await client.getConnectorRuleByName(name);
    }

    if (!data) {
        console.log('WARNING onFileSaved: could not find ' + resourceType + ':', data);
        return;
    }

    const oldid = getIdByUri(olduri);
    // Check old id and new id and check the active window Uri
    // Close the active window to open the 'new' uri with the id
    if (oldid !== data.id && olduri === vscode.window.activeTextEditor?.document.uri) {
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        const newUri = getResourceUri(tenantName, resourceType, data.id, data.name, isBeta);

        // Open document and then show document to force JSON
        let document = await vscode.workspace.openTextDocument(newUri);
        document = await vscode.languages.setTextDocumentLanguage(document, 'json');
        await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });
    }
}