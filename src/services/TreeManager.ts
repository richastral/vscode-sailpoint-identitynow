import * as vscode from 'vscode';
import * as commands from '../commands/constants';
import { SourceTreeItem, TenantTreeItem } from "../models/ISCTreeItem";
import { ISCDataProvider } from "../views/ISCDataProvider";
import { SailPointISCAuthenticationProvider } from "./AuthenticationProvider";
import { ISCClient } from "./ISCClient";
import { TenantService } from "./TenantService";
import { TransformEvaluator } from './TransformEvaluator';
import { TaskStatusBeta, TaskStatusBetaCompletionStatusEnum } from 'sailpoint-api-client';
import { confirm } from '../utils/vsCodeHelpers';
import { formatTask, waifForJob } from '../commands/source/sourceUtils';

export class TreeManager {

    constructor(
        private readonly dataProvider: ISCDataProvider,
        private readonly tenantService: TenantService,
        private readonly authProvider: SailPointISCAuthenticationProvider,
        private readonly transformEvaluator: TransformEvaluator,
    ) { }

    public async removeTenant(item: TenantTreeItem): Promise<void> {
        console.log("> removeTenant", item);
        // assessing that item is a TenantTreeItem
        if (item === undefined || !(item instanceof TenantTreeItem)) {
            console.log("WARNING: removeTenant: invalid item", item);
            throw new Error("removeTenant: invalid item");
        }
        const tenantName = item.tenantName || "";
        const response = await vscode.window.showWarningMessage(
            `Are you sure you want to delete tenant ${tenantName}?`,
            { modal: true },
            ...["Yes", "No"]
        );
        if (response !== "Yes") {
            console.log("< removeTenant: no delete");
            return;
        }
        try {
            const session = await vscode.authentication.getSession(SailPointISCAuthenticationProvider.id, [item.tenantId], { createIfNone: false });
            if (session !== undefined) {
                this.authProvider.removeSession(session.id);
            }
        } catch (err) {
            console.error("Session for ", tenantName, "does not exist:", err);
        }
        await this.tenantService.removeTenant(item.tenantId);
        vscode.commands.executeCommand(commands.REFRESH_FORCED);
        vscode.window.showInformationMessage(`Successfully deleted tenant ${tenantName}`);
    }

    public async resetEntitlements(item: SourceTreeItem, doConfirm = true): Promise<TaskStatusBeta | undefined> {
        console.log("> resetEntitlements", item)
        if (doConfirm && !(await confirm(`Are you sure you want to reset entitlements for ${item.label}?`))) {
            return
        }

        const client = new ISCClient(item.tenantId, item.tenantName);

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Resetting entitlements from ${item.label}`,
            cancellable: true
        }, async (progress, token) => {
            const job = await client.startEntitlementReset(item.id);
            const task = await waifForJob(client, job.id, token)
            formatTask(task,
                item.label as string,
                "Entitlements for {0} successfully resetted",
                "Warning during entitlement reset of {0}: {1}",
                "Reset of entitlements for {0} failed: {1}: {2}"
            )
            return undefined;
        });
    }

    public async resetAccounts(item: SourceTreeItem, doConfirm = true): Promise<TaskStatusBeta | undefined> {
        console.log("> resetAccounts", item)
        if (doConfirm && !(await confirm(`Are you sure you want to reset accounts for ${item.label}?`))) {
            return
        }

        const client = new ISCClient(item.tenantId, item.tenantName);

        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Resetting accounts from ${item.label}`,
            cancellable: true
        }, async (progress, token) => {
            const job = await client.startAccountReset(item.id);
            const task = await waifForJob(client, job.id, token)
            formatTask(task,
                item.label as string,
                "Accounts for {0} successfully resetted",
                "Warning during account reset of {0}: {1}",
                "Reset of accounts for {0} failed: {1}: {2}"
            )
            return task;
        });
    }

    public async aggregateEntitlements(item: SourceTreeItem): Promise<void> {
        console.log("> aggregateEntitlements", item)
        const client = new ISCClient(item.tenantId, item.tenantName);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Aggregation entitlements from ${item.label}`,
            cancellable: true
        }, async (progress, token) => {
            const job = await client.startEntitlementAggregation(item.id);
            const task = await waifForJob(client, job.id, token)
            formatTask(task,
                item.label as string,
                "Source entitlements {0} successfully aggregated",
                "Warning during aggregation of {0}: {1}",
                "Aggregation of entitlements for {0} failed: {1}: {2}"
            )
        });
    }

    public async aggregateSource(item: SourceTreeItem, disableOptimization = false): Promise<void> {
        console.log("> aggregateSource", item, disableOptimization);

        const client = new ISCClient(item.tenantId, item.tenantName);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Aggregation accounts from ${item.label}`,
            cancellable: true
        }, async (progress, token) => {


            const job = await client.startAccountAggregation(item.id!, disableOptimization)
            const task = await waifForJob(client, job.task.id, token)
            formatTask(task,
                item.label as string,
                "Source {0} successfully aggregated",
                "Warning during aggregation of {0}: {1}",
                "Aggregation of {0} failed: {1}: {2}"
            )
        });
    }

    public async resetSource(item: SourceTreeItem): Promise<void> {
        console.log("> resetSource", item);
        if (!(await confirm(`Are you sure you want to reset the source ${item.label}?`))) {
            return
        }
        const task = await this.resetAccounts(item, false)
        if (task?.completionStatus.toUpperCase() === TaskStatusBetaCompletionStatusEnum.Success.toUpperCase()) {
            await this.resetEntitlements(item, false)
        }
    }

    public async evaluateTransform(item: SourceTreeItem): Promise<void> {
        console.log("> NewTransformCommand.evaluate", item);

        await this.transformEvaluator.evaluate(item);
    };
}