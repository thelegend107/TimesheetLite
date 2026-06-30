IF DB_ID(N'Timesheet') IS NULL
BEGIN
    CREATE DATABASE [Timesheet];
END;
GO

USE [Timesheet];
GO

SET ANSI_NULLS ON;
GO

SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'[dbo].[TimeEntry]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[TimeEntry]
    (
        [Id] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_TimeEntry] PRIMARY KEY CLUSTERED,
        [WorkDate] DATE NOT NULL,
        [Project] NVARCHAR(100) NOT NULL,
        [Task] NVARCHAR(100) NOT NULL,
        [StartTime] TIME(0) NULL,
        [EndTime] TIME(0) NULL,
        [Hours] DECIMAL(5,2) NOT NULL,
        [Notes] NVARCHAR(1000) NULL,
        [CreatedDate] DATETIMEOFFSET NOT NULL CONSTRAINT [DF_TimeEntry_CreatedDate] DEFAULT SYSDATETIMEOFFSET(),
        [UpdatedDate] DATETIMEOFFSET NOT NULL CONSTRAINT [DF_TimeEntry_UpdatedDate] DEFAULT SYSDATETIMEOFFSET(),

        CONSTRAINT [CK_TimeEntry_Hours] CHECK ([Hours] > 0 AND [Hours] <= 24)
    );
END;
GO

IF COL_LENGTH(N'[dbo].[TimeEntry]', N'Project') IS NULL
BEGIN
    ALTER TABLE [dbo].[TimeEntry]
    ADD [Project] NVARCHAR(100) NULL;
END;
GO

IF COL_LENGTH(N'[dbo].[TimeEntry]', N'Project') IS NOT NULL
BEGIN
    UPDATE [dbo].[TimeEntry]
    SET [Project] = N'Unassigned'
    WHERE [Project] IS NULL;

    IF EXISTS
    (
        SELECT 1
        FROM [sys].[columns]
        WHERE [object_id] = OBJECT_ID(N'[dbo].[TimeEntry]')
          AND [name] = N'Project'
          AND [is_nullable] = 1
    )
    BEGIN
        ALTER TABLE [dbo].[TimeEntry]
        ALTER COLUMN [Project] NVARCHAR(100) NOT NULL;
    END;
END;
GO

IF COL_LENGTH(N'[dbo].[TimeEntry]', N'Task') IS NULL
BEGIN
    ALTER TABLE [dbo].[TimeEntry]
    ADD [Task] NVARCHAR(100) NULL;
END;
GO

IF COL_LENGTH(N'[dbo].[TimeEntry]', N'Task') IS NOT NULL
BEGIN
    UPDATE [dbo].[TimeEntry]
    SET [Task] = N''
    WHERE [Task] IS NULL;

    IF EXISTS
    (
        SELECT 1
        FROM [sys].[columns]
        WHERE [object_id] = OBJECT_ID(N'[dbo].[TimeEntry]')
          AND [name] = N'Task'
          AND [is_nullable] = 1
    )
    BEGIN
        ALTER TABLE [dbo].[TimeEntry]
        ALTER COLUMN [Task] NVARCHAR(100) NOT NULL;
    END;
END;
GO

IF COL_LENGTH(N'[dbo].[TimeEntry]', N'StartTime') IS NULL
BEGIN
    ALTER TABLE [dbo].[TimeEntry]
    ADD [StartTime] TIME(0) NULL;
END;
GO

IF COL_LENGTH(N'[dbo].[TimeEntry]', N'EndTime') IS NULL
BEGIN
    ALTER TABLE [dbo].[TimeEntry]
    ADD [EndTime] TIME(0) NULL;
END;
GO

IF COL_LENGTH(N'[dbo].[TimeEntry]', N'Notes') IS NULL
BEGIN
    ALTER TABLE [dbo].[TimeEntry]
    ADD [Notes] NVARCHAR(1000) NULL;
END;
GO

IF COL_LENGTH(N'[dbo].[TimeEntry]', N'CreatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[TimeEntry]
    ADD [CreatedDate] DATETIMEOFFSET NOT NULL
        CONSTRAINT [DF_TimeEntry_CreatedDate] DEFAULT SYSDATETIMEOFFSET();
END;
GO

IF COL_LENGTH(N'[dbo].[TimeEntry]', N'UpdatedDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[TimeEntry]
    ADD [UpdatedDate] DATETIMEOFFSET NOT NULL
        CONSTRAINT [DF_TimeEntry_UpdatedDate] DEFAULT SYSDATETIMEOFFSET();
END;
GO

IF COL_LENGTH(N'[dbo].[TimeEntry]', N'CreatedDate') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1
       FROM [sys].[default_constraints] AS [dc]
       INNER JOIN [sys].[columns] AS [c]
           ON [c].[object_id] = [dc].[parent_object_id]
          AND [c].[column_id] = [dc].[parent_column_id]
       WHERE [dc].[parent_object_id] = OBJECT_ID(N'[dbo].[TimeEntry]')
         AND [c].[name] = N'CreatedDate'
   )
BEGIN
    ALTER TABLE [dbo].[TimeEntry]
    ADD CONSTRAINT [DF_TimeEntry_CreatedDate]
    DEFAULT SYSDATETIMEOFFSET() FOR [CreatedDate];
END;
GO

IF COL_LENGTH(N'[dbo].[TimeEntry]', N'UpdatedDate') IS NOT NULL
   AND NOT EXISTS
   (
       SELECT 1
       FROM [sys].[default_constraints] AS [dc]
       INNER JOIN [sys].[columns] AS [c]
           ON [c].[object_id] = [dc].[parent_object_id]
          AND [c].[column_id] = [dc].[parent_column_id]
       WHERE [dc].[parent_object_id] = OBJECT_ID(N'[dbo].[TimeEntry]')
         AND [c].[name] = N'UpdatedDate'
   )
BEGIN
    ALTER TABLE [dbo].[TimeEntry]
    ADD CONSTRAINT [DF_TimeEntry_UpdatedDate]
    DEFAULT SYSDATETIMEOFFSET() FOR [UpdatedDate];
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM [sys].[check_constraints]
    WHERE [name] = N'CK_TimeEntry_Hours'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[TimeEntry]')
)
BEGIN
    ALTER TABLE [dbo].[TimeEntry] WITH CHECK
    ADD CONSTRAINT [CK_TimeEntry_Hours]
    CHECK ([Hours] > 0 AND [Hours] <= 24);
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM [sys].[indexes]
    WHERE [name] = N'IX_TimeEntry_WorkDate'
      AND [object_id] = OBJECT_ID(N'[dbo].[TimeEntry]')
)
BEGIN
    CREATE INDEX [IX_TimeEntry_WorkDate]
    ON [dbo].[TimeEntry] ([WorkDate]);
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM [sys].[indexes]
    WHERE [name] = N'IX_TimeEntry_Project_WorkDate'
      AND [object_id] = OBJECT_ID(N'[dbo].[TimeEntry]')
)
BEGIN
    CREATE INDEX [IX_TimeEntry_Project_WorkDate]
    ON [dbo].[TimeEntry] ([Project], [WorkDate]);
END;
GO

CREATE OR ALTER VIEW [dbo].[vTimeEntryWeeklySummary]
AS
SELECT
    CAST(DATEADD(DAY, -DATEDIFF(DAY, 0, [WorkDate]) % 7, [WorkDate]) AS DATE) AS [WeekStart],
    [Project],
    SUM([Hours]) AS [TotalHours]
FROM [dbo].[TimeEntry]
GROUP BY
    CAST(DATEADD(DAY, -DATEDIFF(DAY, 0, [WorkDate]) % 7, [WorkDate]) AS DATE),
    [Project];
GO
