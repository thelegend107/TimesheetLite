IF DB_NAME() IN (N'master', N'model', N'msdb', N'tempdb')
BEGIN
    RAISERROR(N'Select the Timesheet database before running this script. It was not run.', 16, 1);
    SET NOEXEC ON;
END;
GO

IF OBJECT_ID(N'[dbo].[ClockifyEntryLink]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ClockifyEntryLink]
    (
        [TimeEntryId] INT NOT NULL CONSTRAINT [PK_ClockifyEntryLink] PRIMARY KEY CLUSTERED,
        [WorkDate] DATE NOT NULL,
        [WorkspaceId] NVARCHAR(40) NOT NULL,
        [ClockifyEntryId] NVARCHAR(40) NOT NULL,
        [Fingerprint] NVARCHAR(64) NOT NULL,
        [Label] NVARCHAR(200) NOT NULL,
        [SyncedAt] DATETIMEOFFSET NOT NULL CONSTRAINT [DF_ClockifyEntryLink_SyncedAt] DEFAULT SYSDATETIMEOFFSET()
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM [sys].[indexes]
    WHERE [name] = N'IX_ClockifyEntryLink_WorkDate'
      AND [object_id] = OBJECT_ID(N'[dbo].[ClockifyEntryLink]')
)
BEGIN
    CREATE INDEX [IX_ClockifyEntryLink_WorkDate]
    ON [dbo].[ClockifyEntryLink] ([WorkDate]);
END;
GO

IF OBJECT_ID(N'[dbo].[ClockifyProjectMap]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ClockifyProjectMap]
    (
        [Project] NVARCHAR(100) NOT NULL CONSTRAINT [PK_ClockifyProjectMap] PRIMARY KEY CLUSTERED,
        [ClockifyProjectId] NVARCHAR(40) NOT NULL
    );
END;
GO

IF OBJECT_ID(N'[dbo].[ClockifyTaskRule]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ClockifyTaskRule]
    (
        [Project] NVARCHAR(100) NOT NULL,
        [Phrase] NVARCHAR(100) NOT NULL,
        [ClockifyProjectId] NVARCHAR(40) NOT NULL,
        [Billable] BIT NULL,
        CONSTRAINT [PK_ClockifyTaskRule] PRIMARY KEY CLUSTERED ([Project], [Phrase])
    );
END;
GO

IF COL_LENGTH(N'[dbo].[ClockifyTaskRule]', N'Billable') IS NULL
BEGIN
    ALTER TABLE [dbo].[ClockifyTaskRule] ADD [Billable] BIT NULL;
END;
GO

IF OBJECT_ID(N'[dbo].[ClockifyConnection]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ClockifyConnection]
    (
        [Id] INT NOT NULL CONSTRAINT [PK_ClockifyConnection] PRIMARY KEY CLUSTERED,
        [ProtectedApiKey] NVARCHAR(MAX) NOT NULL,
        [SavedAt] DATETIMEOFFSET NOT NULL CONSTRAINT [DF_ClockifyConnection_SavedAt] DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT [CK_ClockifyConnection_Single] CHECK ([Id] = 1)
    );
END;
GO
