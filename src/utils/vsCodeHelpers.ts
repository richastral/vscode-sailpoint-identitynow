import * as vscode from "vscode";
import { TenantService } from "../services/TenantService";
import * as fs from 'fs';

export async function chooseTenant(tenantService: TenantService, title: string): Promise<string | undefined> {
	console.log("> chooseTenant");
	const tenants = tenantService.getTenants().sort();
	let tenantName: string | undefined = '';
	if (tenants.length < 1) {
		return;
	} else if (tenants.length === 1) {
		tenantName = tenants[0];
	} else {
		tenantName = await vscode.window.showQuickPick(tenants, { placeHolder: title });
		if (tenantName === undefined) {
			console.log("chooseTenant: no tenant");
			return undefined;
		}
	}
	console.log("<chooseTenant: tenant = ", tenantName);
	return tenantName;
}

export function getSelectionContent(editor: vscode.TextEditor): string | undefined {
	var selections = editor.selections;

	if (!selections
		|| !selections.length
		|| (selections.length === 1
			&& selections[0].isSingleLine
			&& selections[0].start.character === selections[0].end.character)
	) {
		return editor.document.getText(getFullDocumentRange(editor));
	}

	return editor.document.getText(selections[0]);
}


export function getFullDocumentRange(editor: vscode.TextEditor): vscode.Selection {
	if (editor.document.lineCount > 0) {
		let lineCount = editor.document.lineCount;
		return new vscode.Selection(0, 0, lineCount - 1, editor.document.lineAt(lineCount - 1).text.length);
	}

	return new vscode.Selection(0, 0, 0, 0);
}

/**
 * If the file already exists, request confirmation to overwrite the content of the file. It actually deletes it.
 * @returns true if user is OK for overwriting
 */
export async function confirmFileOverwrite(exportFile: string): Promise<boolean> {
	if (fs.existsSync(exportFile)) {
		const answer = await vscode.window.showQuickPick(["No", "Yes"], { placeHolder: 'The file already exists, do you want to overwrite it?' });
		if (answer === undefined || answer === "No") {
			console.log("< confirmFileOverwrite: do not overwrite file");
			return false;
		}
		fs.unlinkSync(exportFile);
	}
	console.log("< confirmFileOverwrite: overwrite file");
	return true;
}