'use strict';
import { commands, TextEditor, Uri, window } from 'vscode';
import { GlyphChars } from '../constants';
import { Container } from '../container';
import { Logger } from '../logger';
import { Messages } from '../messages';
import { CommandQuickPickItem, StashListQuickPick } from '../quickpicks';
import { Strings } from '../system';
import { ActiveEditorCachedCommand, command, Commands, getCommandUri, getRepoPathOrActiveOrPrompt } from './common';
import { ShowQuickCommitDetailsCommandArgs } from './showQuickCommitDetails';

export interface ShowQuickStashListCommandArgs {
    goBackCommand?: CommandQuickPickItem;
}

@command()
export class ShowQuickStashListCommand extends ActiveEditorCachedCommand {
    constructor() {
        super(Commands.ShowQuickStashList);
    }

    async execute(editor?: TextEditor, uri?: Uri, args: ShowQuickStashListCommandArgs = {}) {
        uri = getCommandUri(uri, editor);

        const repoPath = await getRepoPathOrActiveOrPrompt(
            uri,
            editor,
            `Show stashed changes for which repository${GlyphChars.Ellipsis}`
        );
        if (!repoPath) return undefined;

        const progressCancellation = StashListQuickPick.showProgress('list');

        try {
            const stash = await Container.git.getStashList(repoPath);
            if (stash === undefined) return window.showWarningMessage('Unable to show stashed changes');

            if (progressCancellation.token.isCancellationRequested) return undefined;

            // Create a command to get back to here
            const currentCommandArgs: ShowQuickStashListCommandArgs = {
                goBackCommand: args.goBackCommand
            };
            const currentCommand = new CommandQuickPickItem(
                {
                    label: `go back ${GlyphChars.ArrowBack}`,
                    description: `${Strings.pad(GlyphChars.Dash, 2, 3)} to stashed changes`
                },
                Commands.ShowQuickStashList,
                [uri, currentCommandArgs]
            );

            const pick = await StashListQuickPick.show(
                stash,
                'list',
                progressCancellation,
                args.goBackCommand,
                currentCommand
            );
            if (pick === undefined) return undefined;

            if (pick instanceof CommandQuickPickItem) return pick.execute();

            const commandArgs: ShowQuickCommitDetailsCommandArgs = {
                commit: pick.commit,
                sha: pick.commit.sha,
                goBackCommand: currentCommand
            };
            return commands.executeCommand(Commands.ShowQuickCommitDetails, pick.commit.toGitUri(), commandArgs);
        }
        catch (ex) {
            Logger.error(ex, 'ShowQuickStashListCommand');
            return Messages.showGenericErrorMessage('Unable to show stashed changes');
        }
        finally {
            progressCancellation.cancel();
        }
    }
}
