#!/usr/bin/env python3
"""
CSV to HTML Generator for Tennis Match Visualizations

This script processes a CSV file containing tennis match data and generates
a standalone HTML file with all court visualizations embedded.

Usage:
    python csv_to_html_generator.py <csv_file_path> <player1_name> <player2_name> [output_file.html]
"""

import pandas as pd
import numpy as np
import json
import os
import sys
import warnings
from pathlib import Path

warnings.filterwarnings('ignore')


# ============================================================================
# DATA PROCESSING FUNCTIONS
# ============================================================================

def return_contact(player, events):
    """Process return contact data"""
    events = events.copy()
    events['pointWonBy'] = events.groupby('pointNumber')['pointWonBy'].bfill()
    returns_ucla = events[(events['shotHitBy'] == player) & (events['shotInRally'] == 2)][
        ['pointStartTime', 'shotHitBy', 'shotContactX', 'shotContactY', 'pointWonBy', 'isWinner', 'shotFhBh']
    ].dropna(subset=['pointWonBy', 'shotContactX', 'shotContactY']).copy()
    
    returns_ucla['shotContactX'] = returns_ucla.apply(lambda row: -row['shotContactX'] if row['shotContactY'] > 0 else row['shotContactX'], axis=1)
    returns_ucla['shotContactY'] = returns_ucla['shotContactY'].apply(lambda y: -y if y > 0 else y)
    returns_ucla['depth'] = returns_ucla['shotContactY'].apply(
        lambda y: 'short' if y >= -455 else 'mid' if -455 > y > -490 else 'deep'
    )

    distribution = returns_ucla.groupby('depth').apply(
        lambda df: pd.Series({
            'freq': len(df),
            'win_percentage': int((df['pointWonBy'] == df['shotHitBy']).mean() * 100)
        })
    ).reset_index()

    max_win_percentage = distribution['win_percentage'].max()
    min_win_percentage = distribution['win_percentage'].min()

    distribution['maxMin'] = distribution['win_percentage'].apply(
        lambda x: 'max' if x == max_win_percentage else 'min' if x == min_win_percentage else 'no'
    )

    distribution['win_percentage'] = distribution['win_percentage'].astype(str) + '%'

    y_mapping = {
        'short': {'y': -420},
        'mid': {'y': -475},
        'deep': {'y': -515}
    }

    distribution['y'] = distribution['depth'].map(lambda d: y_mapping[d]['y'])

    return returns_ucla.to_dict('records'), distribution.to_dict('records')


def net_errors(player, events):
    """Process net errors data"""
    events = events.copy()
    events['pointWonBy'] = events.groupby('pointNumber')['pointWonBy'].bfill()

    net_errors = events[(events['shotHitBy'] == player) & (events['isErrorNet'] == 1.0)][
        ['pointStartTime', 'shotHitBy','shotContactX', 'shotContactY', 'shotLocationX', 'shotLocationY', 'pointWonBy', 'shotFhBh']
    ].dropna(subset=['pointWonBy']).copy()

    net_errors = net_errors.dropna()
    net_errors['shotLocationX'] = net_errors.apply(lambda row: -row['shotLocationX'] if row['shotContactY'] > 0 else row['shotLocationX'], axis=1)
    net_errors['shotLocationY'] = net_errors.apply(lambda row: -row['shotLocationY'] if row['shotContactY'] > 0 else row['shotLocationY'], axis=1)
    net_errors['shotContactX'] = net_errors.apply(lambda row: -row['shotContactX'] if row['shotContactY'] > 0 else row['shotContactX'], axis=1)
    net_errors['shotContactY'] = net_errors.apply(lambda row: -row['shotContactY'] if row['shotContactY'] > 0 else row['shotContactY'], axis=1)

    return net_errors.to_dict('records')


def return_place(player, events, side, fh_bh):
    """Process return placement data"""
    events = events.copy()
    events['pointWonBy'] = events.groupby('pointNumber')['pointWonBy'].bfill()
    events['isError'] = (events['isErrorWideR'] == 1) | (events['isErrorWideL'] == 1) | (events['isErrorNet'] == 1) | (events['isErrorLong'] == 1)
    
    returns_place = events[(events['shotHitBy'] == player) & (events['shotInRally'] == 2)][
        ['pointStartTime', 'shotHitBy', 'shotContactX', 'shotContactY', 'shotLocationX', 'shotLocationY',
         'pointWonBy', 'isWinner', 'shotFhBh', 'isError', 'isErrorNet', 'side']
    ].dropna(subset=['pointWonBy']).copy()
    
    mask_bottom_half = (returns_place['shotLocationY'] < 0) & (returns_place['shotContactY'] > 0)
    mask_near_net = (returns_place['shotLocationY'] <= 50) & (returns_place['shotContactY'] > 0) & (returns_place['isErrorNet'] == 1)

    returns_place.loc[mask_bottom_half, 'shotContactX'] *= -1
    returns_place.loc[mask_bottom_half, 'shotLocationX'] *= -1
    returns_place.loc[mask_bottom_half & (returns_place['shotContactY'] > 0), 'shotContactY'] *= -1
    returns_place.loc[mask_bottom_half, 'shotLocationY'] = returns_place.loc[mask_bottom_half, 'shotLocationY'].abs()

    returns_place.loc[mask_near_net & ~mask_bottom_half, 'shotContactX'] *= -1
    returns_place.loc[mask_near_net & ~mask_bottom_half, 'shotLocationX'] *= -1
    returns_place.loc[mask_near_net & ~mask_bottom_half, 'shotContactY'] *= -1

    mask = (returns_place['shotLocationY'] != 0) & (returns_place['isErrorNet'] == 1)
    adjust_up = mask & (returns_place['shotLocationX'] <= returns_place['shotContactX'])
    adjust_down = mask & (returns_place['shotLocationX'] > returns_place['shotContactX'])

    returns_place.loc[adjust_up, 'shotLocationX'] += returns_place.loc[adjust_up, 'shotLocationY']
    returns_place.loc[adjust_down, 'shotLocationX'] -= returns_place.loc[adjust_down, 'shotLocationY']
    returns_place.loc[adjust_up, 'shotContactX'] += returns_place.loc[adjust_up, 'shotLocationY']
    returns_place.loc[adjust_down, 'shotContactX'] -= returns_place.loc[adjust_down, 'shotLocationY']
    returns_place.loc[adjust_up, 'shotLocationY'] = 0
    returns_place.loc[adjust_down, 'shotLocationY'] = 0

    if side != 'All':
        if fh_bh != 'All':
            returns_place = returns_place[returns_place['shotFhBh'] == fh_bh]
        returns_place = returns_place[returns_place['side'] == side]

    returns_place['fhBhFiltered'] = [fh_bh != 'All'] * len(returns_place)
    returns_place['sideFiltered'] = [side != 'All'] * len(returns_place)

    returns_place['width'] = returns_place['shotLocationX'].apply(
        lambda x: 'left' if x <= -52.5 else 'mid' if -52.5 < x < 52.5 else 'right'
    )

    distribution = returns_place.groupby('width').apply(
        lambda df: pd.Series({
            'freq': len(df),
            'win_percentage': int((df['pointWonBy'] == df['shotHitBy']).mean() * 100)
        })
    ).reset_index()

    max_win_percentage = distribution['win_percentage'].max()
    min_win_percentage = distribution['win_percentage'].min()

    distribution['maxMin'] = distribution['win_percentage'].apply(
        lambda x: 'max' if x == max_win_percentage else 'min' if x == min_win_percentage else 'no'
    )

    distribution['win_percentage'] = distribution['win_percentage'].astype(str) + '%'

    return returns_place.to_dict('records'), distribution.to_dict('records')


def serve_dist(player, events):
    """Process serve distribution data"""
    events = events.copy()
    events['pointWonBy'] = events.groupby('pointNumber')['pointWonBy'].bfill()
    
    filtered_events = events[
        (events['shotInRally'] == 1) &
        (events['serverName'] == player) &
        ((events['firstServeIn'] == 1.0) | (events['secondServeIn'] == 1.0))
    ]
    
    valid_placements = ['Wide', 'T', 'Body']
    filtered_events = filtered_events[filtered_events['serveInPlacement'].isin(valid_placements)]
    filtered_events['Zone'] = filtered_events['side'] + " " + filtered_events['serveInPlacement']

    serve_counts = filtered_events.groupby('Zone').size()
    
    won_counts = filtered_events[filtered_events['pointWonBy'] == player].groupby('Zone').size()
    won_counts = won_counts.reindex(serve_counts.index, fill_value=0)
    
    serve_dist = pd.DataFrame({
        "Zone": serve_counts.index,
        "Win Proportion": won_counts.astype(str) + '/' + serve_counts.astype(str)
    }).reset_index(drop=True)

    serve_dist['Server'] = [player, "", "", "", "", ""]
    
    return serve_dist.to_dict('records')


def serve_error_dist(player, events):
    """Process serve error distribution data"""
    events = events.copy()
    events['pointWonBy'] = events.groupby('pointNumber')['pointWonBy'].bfill()

    returns = events[(events['serverName'] == player) & (events['shotInRally'] == 1)].copy()

    returns['firstServeXCoord'] = returns.apply(lambda row: -row['firstServeXCoord'] if row['firstServeYCoord'] < 0 else row['firstServeXCoord'], axis=1)
    returns['secondServeXCoord'] = returns.apply(lambda row: -row['secondServeXCoord'] if row['secondServeYCoord'] < 0 else row['secondServeXCoord'], axis=1)
    returns['firstServeYCoord'] = returns['firstServeYCoord'].apply(lambda y: -y if y < 0 else y)
    returns['secondServeYCoord'] = returns['secondServeYCoord'].apply(lambda y: -y if y < 0 else y) 

    returns['firstServeYCoord'] = returns['firstServeYCoord'].apply(lambda y: 0 if y <= 25 else y)
    returns['secondServeYCoord'] = returns['secondServeYCoord'].apply(lambda y: 0 if y <= 25 else y)

    returns = returns[
        (returns['firstServeIn'] != 1.0) | 
        ((returns['firstServeIn'] != 1.0) & (returns['secondServeIn'] != 1.0))
    ]

    returns['x'] = np.where(returns['firstServeIn'] != 1.0, returns['firstServeXCoord'], returns['secondServeXCoord'])
    returns['y'] = np.where(returns['firstServeIn'] != 1.0, returns['firstServeYCoord'], returns['secondServeYCoord'])

    double_errors = returns[(returns['firstServeIn'] != 1.0) & (returns['secondServeIn'] != 1.0)]
    if not double_errors.empty:
        first_serve_errors = double_errors.copy()
        second_serve_errors = double_errors.copy()

        first_serve_errors['x'] = first_serve_errors['firstServeXCoord']
        first_serve_errors['y'] = first_serve_errors['firstServeYCoord']

        second_serve_errors['x'] = second_serve_errors['secondServeXCoord']
        second_serve_errors['y'] = second_serve_errors['secondServeYCoord']

        returns = pd.concat([returns, first_serve_errors, second_serve_errors], ignore_index=True)
    else:
        returns = pd.concat([returns, double_errors], ignore_index=True)

    serve_errors = returns[['serverName', 'firstServeIn', 'secondServeIn', 'x', 'y']]
    
    serve_errors['type'] = np.select(
        [
            (serve_errors['x'] < 0) & (serve_errors['y'] == 0),
            ((serve_errors['x'] < -157.5) & (serve_errors['y'] < 0) & (serve_errors['y'] < 245)) |
            ((serve_errors['x'] > 0) & (serve_errors['x'] < 157.5) & (serve_errors['y'] < 0) & (serve_errors['y'] < 245)),
            (serve_errors['x'] < 0) & (serve_errors['y'] > 245),
            (serve_errors['x'] > 0) & (serve_errors['y'] == 0),
            ((serve_errors['x'] > 157.5) & (serve_errors['y'] < 0) & (serve_errors['y'] < 245)) |
            ((serve_errors['x'] < 0) & (serve_errors['x'] > -157.5) & (serve_errors['y'] < 0) & (serve_errors['y'] < 245)),
            (serve_errors['x'] > 0) & (serve_errors['y'] > 245)
        ],
        [
            'Deuce Net', 'Deuce Wide', 'Deuce Long', 'Ad Net', 'Ad Wide', 'Ad Long'
        ],
        default='Unknown'
    )

    errorTypes = ['Deuce Net', 'Deuce Wide', 'Deuce Long', 'Ad Net', 'Ad Wide', 'Ad Long']

    serve_distribution = serve_errors.groupby('type').size().reindex(errorTypes, fill_value=0).reset_index(name='count')

    return serve_errors.to_dict('records'), serve_distribution.to_dict('records')


def serve_place(player, events):
    """Process serve placement data"""
    events = events.copy()
    events['pointWonBy'] = events.groupby('pointNumber')['pointWonBy'].bfill()

    serves = events.groupby('pointNumber').apply(lambda df: pd.Series({
        'pointNumber': df['pointNumber'].iloc[0],
        'pointStartTime': df['pointStartTime'].iloc[0],
        'serverName': df['serverName'].iloc[0],
        'x': df['firstServeXCoord'].iloc[0] if df['firstServeIn'].iloc[0] == 1.0 else df['secondServeXCoord'].iloc[0],
        'y': df['firstServeYCoord'].iloc[0] if df['firstServeIn'].iloc[0] == 1.0 else df['secondServeYCoord'].iloc[0],
        'serveIn': (df['firstServeIn'].iloc[0] == 1.0) or (df['secondServeIn'].iloc[0] == 1.0),
        'side': df['side'].iloc[0],
        'serveInPlacement': df['serveInPlacement'].iloc[0],
        'pointWonByUCLA': (df['pointWonBy'].iloc[0] == player),
        'isAce': df['isAce'].iloc[0]
    })).reset_index(drop=True)

    serves = serves[serves['serveIn']]

    serves_ucla = serves[(serves['serverName'] == player) & (serves['serveIn'])].copy()

    serves_ucla['x'] = np.where(serves_ucla['y'] < 0, -serves_ucla['x'], serves_ucla['x'])
    serves_ucla['y'] = np.where(serves_ucla['y'] < 0, -serves_ucla['y'], serves_ucla['y'])

    serves_ucla['serveOutcome'] = np.where(
        serves_ucla['isAce'] == 1.0, 'Ace',
        np.where(serves_ucla['pointWonByUCLA'], 'Won', 'Lost')
    )

    valid_placements = ['Wide', 'T', 'Body']
    serves_ucla = serves_ucla[serves_ucla['serveInPlacement'].isin(valid_placements)]

    distribution = serves_ucla.groupby(['side', 'serveInPlacement']).agg(
        count=('pointNumber', 'size'),
        serves_won=('pointWonByUCLA', 'sum')
    ).reset_index() 

    distribution['proportion'] = distribution['serves_won'] / distribution['count']

    min_proportion = distribution['proportion'].min()
    max_proportion = distribution['proportion'].max()

    labels = distribution.copy()
    labels['proportion_label'] = (labels['proportion'] * 100).round(1).astype(str) + "%"
    labels['count_label'] = labels['count']

    labels['x'] = np.where(
        (labels['side'] == 'Ad') & (labels['serveInPlacement'] == 'Wide'), 131.25,
        np.where(
            (labels['side'] == 'Ad') & (labels['serveInPlacement'] == 'Body'), 78.75,
            np.where(
                (labels['side'] == 'Ad') & (labels['serveInPlacement'] == 'T'), 26.25,
                np.where(
                    (labels['side'] == 'Deuce') & (labels['serveInPlacement'] == 'T'), -26.25,
                    np.where(
                        (labels['side'] == 'Deuce') & (labels['serveInPlacement'] == 'Body'), -78.75,
                        np.where(
                            (labels['side'] == 'Deuce') & (labels['serveInPlacement'] == 'Wide'), -131.25,
                            np.nan
                        )
                    )
                )
            )
        )
    )

    labels['text_color'] = np.where(
        labels['proportion'] == min_proportion, "darkred",
        np.where(labels['proportion'] == max_proportion, "darkgreen", "black")
    )

    labels['max_min'] = np.where(
        labels['proportion'] == max_proportion, "max",
        np.where(labels['proportion'] == min_proportion, "min", "no")
    )

    return serves_ucla.to_dict('records'), labels.to_dict('records')


def summary_stats(player1, player2, events):
    """Process summary statistics data"""
    events = events.copy()
    events['pointWonBy'] = events.groupby('pointNumber')['pointWonBy'].bfill()

    players = [player1, player2]
    summary_stats = pd.DataFrame({'Stat': ['Aces', 'Double Faults', '1st Serve In', '1st Serve Points Won',
                                        '2nd Serve Points Won', 'Break Points Saved', 'Total Serve Points Won',
                                        'Service Games Won', 'Average Rally Length', '0-4', '5-8', '9+']})

    # Aces
    aces = events[events['isAce'] == 1.0]
    aces_summary = aces['shotHitBy'].value_counts().reset_index()
    aces_summary.columns = ['player', 'Aces']

    for player in players:
        if player in aces_summary['player'].values:
            aces_count = str(aces_summary.loc[aces_summary['player'] == player, 'Aces'].values[0])
            summary_stats.loc[summary_stats['Stat'] == 'Aces', player] = aces_count
        else:
            summary_stats.loc[summary_stats['Stat'] == 'Aces', player] = "0"

    # Double Faults
    double_faults = events[events['isDoubleFault'] == 1.0]
    double_faults_summary = double_faults['shotHitBy'].value_counts().reset_index()
    double_faults_summary.columns = ['player', 'Double Faults']

    for player in players:
        if player in double_faults_summary['player'].values:
            summary_stats.loc[summary_stats['Stat'] == 'Double Faults', player] = f"{double_faults_summary.loc[double_faults_summary['player'] == player, 'Double Faults'].values[0]}"
        else:
            summary_stats.loc[summary_stats['Stat'] == 'Double Faults', player] = "0"

    # 1st Service In, 1st Serve Points Won, and 2nd Serve Points Won
    serves = events[(events['shotInRally'] == 1)]
    first_serve_in = serves[serves['firstServeIn'] == 1.0]
    sec_serve_in = serves[serves['secondServeIn'] == 1.0]

    for player in players:
        total_serves = serves[serves['shotHitBy'] == player].shape[0]
        serves_in = first_serve_in[first_serve_in['shotHitBy'] == player].shape[0]
        summary_stats.loc[summary_stats['Stat'] == '1st Serve In', player] = f"{serves_in}/{total_serves}" if total_serves > 0 else "0"

    for player in players:
        total_serves_in = first_serve_in[first_serve_in['shotHitBy'] == player].shape[0]
        serves_in_and_won = first_serve_in[(first_serve_in['shotHitBy'] == player) & 
                                        (first_serve_in['pointWonBy'] == player)].shape[0]
        summary_stats.loc[summary_stats['Stat'] == '1st Serve Points Won', player] = f"{serves_in_and_won}/{total_serves_in}" if total_serves_in > 0 else "0"

    for player in players:
        total_serves_in = sec_serve_in[sec_serve_in['shotHitBy'] == player].shape[0]
        serves_in_and_won = sec_serve_in[(sec_serve_in['shotHitBy'] == player) & 
                                        (sec_serve_in['pointWonBy'] == player)].shape[0]
        summary_stats.loc[summary_stats['Stat'] == '2nd Serve Points Won', player] = f"{serves_in_and_won}/{total_serves_in}" if total_serves_in > 0 else "0"

    # Break Points Saved
    break_points = events[(events['isBreakPoint'] == 1.0)]
    for player in players:
        total_break_points_faced = break_points[break_points['serverName'] == player].shape[0]
        break_points_saved = break_points[(break_points['serverName'] == player) & 
                                        (break_points['pointWonBy'] == player)].shape[0]
        
        summary_stats.loc[summary_stats['Stat'] == 'Break Points Saved', player] = f"{break_points_saved}/{total_break_points_faced}" if total_break_points_faced > 0 else "0"

    # Total Serve Points Won
    last_shot = events[(events['isPointEnd'] == 1.0)]

    for player in players:
        total_serve_pts = last_shot[last_shot['serverName'] == player].shape[0]
        serve_pts_won = last_shot[(last_shot['serverName'] == player) & 
                                (last_shot['pointWonBy'] == player)].shape[0]
        
        summary_stats.loc[summary_stats['Stat'] == 'Total Serve Points Won', player] = f"{serve_pts_won}/{total_serve_pts}" if total_serve_pts > 0 else "0"

    # Service Games Won
    last_shot['gameGroup'] = (last_shot['gameScore'] != last_shot['gameScore'].shift()).cumsum()
    last_shot_grouped = last_shot.groupby(['gameScore', 'gameGroup']).tail(1).reset_index(drop=True)
    last_shot_grouped = last_shot_grouped.drop(columns=['gameGroup'])
    last_shot_filtered = last_shot_grouped[['gameScore', 'serverName', 'pointWonBy']]

    for player in players:
        total_service_points = last_shot_filtered[last_shot_filtered['serverName'] == player].shape[0]
        service_points_won = last_shot_filtered[(last_shot_filtered['serverName'] == player) &
                                                (last_shot_filtered['pointWonBy'] == player)].shape[0]
        
        summary_stats.loc[summary_stats['Stat'] == 'Service Games Won', player] = f"{service_points_won}/{total_service_points}" if total_service_points > 0 else "0"

    # Average Rally Length
    total_shots = last_shot['shotInRally'].sum()
    num_rallies = last_shot.shape[0]
    avg_rally_len = round(total_shots / num_rallies, 1) if num_rallies > 0 else 0

    summary_stats.loc[summary_stats['Stat'] == 'Average Rally Length', player1] = f"{avg_rally_len:.1f}"
    summary_stats.loc[summary_stats['Stat'] == 'Average Rally Length', player2] = f"{avg_rally_len:.1f}"

    # Win Percentage for Rally Length Groups
    ranges = {
        '0-4': (0, 4),
        '5-8': (5, 8),
        '9+': (9, np.inf)
    }

    for stat_name, (min_shots, max_shots) in ranges.items():
        filtered_shots = last_shot[(last_shot['shotInRally'] >= min_shots) & (last_shot['shotInRally'] <= max_shots)]
        
        for player in players:
            total_points = filtered_shots.shape[0]
            points_won = filtered_shots[filtered_shots['pointWonBy'] == player].shape[0]
            
            summary_stats.loc[summary_stats['Stat'] == f'{stat_name}', player] = f"{points_won}/{total_points}" if total_points > 0 else "0"

    summary_stats['isProp'] = [False, False, True, True , True, True, True , True, False, True, True, True]
    summary_stats['isRallyStat'] = [False, False, False, False , False, False, False , False, True, True, True, True]
    
    return summary_stats.to_dict('records')


def winner_place(player, events):
    """Process winner placement data"""
    events = events.copy()
    events['pointWonBy'] = events.groupby('pointNumber')['pointWonBy'].bfill()
    events['isVolley'] = events['isVolley'].fillna(0)

    winners = events[(events['shotHitBy'] == player) & (events['isWinner'] == 1.0) & (events['pointWonBy'] == player)][
        ['shotHitBy', 'pointStartTime', 'shotContactX', 'shotContactY', 'shotLocationX', 'shotLocationY', 'pointWonBy', 'isVolley', 'shotFhBh']
    ].dropna(subset=['pointWonBy']).copy()

    winners = winners.dropna()
    winners['shotLocationX'] = winners.apply(lambda row: -row['shotLocationX'] if row['shotLocationY'] < 0 else row['shotLocationX'], axis=1)
    winners['shotContactX'] = winners.apply(lambda row: -row['shotContactX'] if row['shotLocationY'] < 0 else row['shotContactX'], axis=1)
    winners['shotContactY'] = winners.apply(lambda row: -row['shotContactY'] if row['shotLocationY'] < 0 else row['shotContactY'], axis=1)
    winners['shotLocationY'] = winners.apply(lambda row: -row['shotLocationY'] if row['shotLocationY'] < 0 else row['shotLocationY'], axis=1)

    return winners.to_dict('records')


def match_summary(player1, player2, events):
    """Process match summary data"""
    events = events.copy()
    last_shot = events[(events['isPointEnd'] == 1.0)]
    games = last_shot.groupby(['setScore']).tail(1).reset_index(drop=True)

    player1_games = []
    player2_games = []
    for _, row in games.iterrows():
        point1, point2 = map(int, row['gameScore'].split('-'))
        if row['pointWonBy'] == player1:
            player1_games.append(point1 + 1)
            player2_games.append(point2)
        else:
            player1_games.append(point1)
            player2_games.append(point2 + 1) 

    set_scores_str = " ".join(f"{p1}-{p2}" for p1, p2 in zip(player1_games, player2_games))

    match_summary = {
        "player1": player1,
        "player2": player2,
        "eventDate": str(events['Date'].iloc[0]),
        "eventName": str(events['Event'].iloc[0]),
        "clientTeam": str(events['clientTeam'].iloc[0]),
        "opponentTeam": str(events['opponentTeam'].iloc[0]),
        "setScores": set_scores_str
    }

    return match_summary


def slice_place(player, events, fh_bh, exclude_times=None):
    """Process slice placement data"""
    events = events.copy()
    events['pointWonBy'] = events.groupby('pointNumber')['pointWonBy'].bfill()
    events['isError'] = (events['isErrorWideR'] == 1) | (events['isErrorWideL'] == 1) | (events['isErrorNet'] == 1) | (events['isErrorLong'] == 1)
    
    slice_place = events[(events['shotHitBy'] == player) & (events['isSlice'] == 1) & (events['shotInRally'] != 1) ][
        ['pointStartTime', 'shotHitBy', 'shotContactX', 'shotContactY', 'shotLocationX', 'shotLocationY',
         'pointWonBy', 'isWinner', 'shotFhBh', 'isError', 'isErrorNet', 'side']
    ].dropna(subset=['pointWonBy']).copy()
    
    if exclude_times:
        slice_place = slice_place[~slice_place['pointStartTime'].isin(exclude_times)]

    mask_bottom_half = (slice_place['shotLocationY'] < 0) & (slice_place['shotContactY'] > 0)
    mask_near_net = (slice_place['shotLocationY'] <= 50) & (slice_place['shotContactY'] > 0) & (slice_place['isErrorNet'] == 1)

    slice_place.loc[mask_bottom_half, 'shotContactX'] *= -1
    slice_place.loc[mask_bottom_half, 'shotLocationX'] *= -1
    slice_place.loc[mask_bottom_half & (slice_place['shotContactY'] > 0), 'shotContactY'] *= -1
    slice_place.loc[mask_bottom_half, 'shotLocationY'] = slice_place.loc[mask_bottom_half, 'shotLocationY'].abs()

    slice_place.loc[mask_near_net & ~mask_bottom_half, 'shotContactX'] *= -1
    slice_place.loc[mask_near_net & ~mask_bottom_half, 'shotLocationX'] *= -1
    slice_place.loc[mask_near_net & ~mask_bottom_half, 'shotContactY'] *= -1

    mask = (slice_place['shotLocationY'] != 0) & (slice_place['isErrorNet'] == 1)
    adjust_up = mask & (slice_place['shotLocationX'] <= slice_place['shotContactX'])
    adjust_down = mask & (slice_place['shotLocationX'] > slice_place['shotContactX'])

    slice_place.loc[adjust_up, 'shotLocationX'] += slice_place.loc[adjust_up, 'shotLocationY']
    slice_place.loc[adjust_down, 'shotLocationX'] -= slice_place.loc[adjust_down, 'shotLocationY']
    slice_place.loc[adjust_up, 'shotContactX'] += slice_place.loc[adjust_up, 'shotLocationY']
    slice_place.loc[adjust_down, 'shotContactX'] -= slice_place.loc[adjust_down, 'shotLocationY']
    slice_place.loc[adjust_up, 'shotLocationY'] = 0
    slice_place.loc[adjust_down, 'shotLocationY'] = 0

    slice_place = slice_place[(slice_place['shotLocationX'] >= -300) & (slice_place['shotLocationX'] <= 300)]

    if fh_bh != 'All':
        slice_place = slice_place[slice_place['shotFhBh'] == fh_bh]

    slice_place['fhBhFiltered'] = [fh_bh != 'All'] * len(slice_place)

    return slice_place.to_dict('records')


# ============================================================================
# HTML GENERATION FUNCTIONS
# ============================================================================

def load_js_file(file_path):
    """Load a JavaScript file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"Warning: Could not find {file_path}")
        return ""


def replace_json_calls(js_code, json_data_map):
    """Replace d3.json() calls with inline data"""
    import re
    
    # Pattern to match d3.json("path/to/file.json")
    pattern = r'd3\.json\(["\']([^"\']+)["\']\)'
    
    def replace_func(match):
        json_path = match.group(1)
        # Normalize path (remove ../ and get filename)
        json_filename = os.path.basename(json_path.replace('../', '').replace('../../', '').replace('../../../', '').replace('../../../../', ''))
        
        # Find matching data
        for key, data in json_data_map.items():
            if json_filename == key or json_filename in key or key in json_filename:
                json_str = json.dumps(data, default=str)
                return f'Promise.resolve({json_str})'
        
        # If not found, try to match by partial name
        for key, data in json_data_map.items():
            base_name = json_filename.replace('.json', '')
            key_base = key.replace('.json', '')
            if base_name == key_base or base_name in key_base or key_base in base_name:
                json_str = json.dumps(data, default=str)
                return f'Promise.resolve({json_str})'
        
        print(f"Warning: Could not find data for {json_path} (filename: {json_filename})")
        return match.group(0)  # Return original if not found
    
    return re.sub(pattern, replace_func, js_code)


def generate_html(csv_path, player1, player2, output_path=None):
    """Generate HTML file from CSV"""
    
    # Load CSV
    print(f"Loading CSV: {csv_path}")
    events = pd.read_csv(csv_path)
    
    # Process all data
    print("Processing match data...")
    json_data = {}
    
    json_data['ret_contact'], json_data['ret_contact_dist'] = return_contact(player1, events)
    json_data['net_errors'] = net_errors(player1, events)
    json_data['return_place_deuce_forehand'], json_data['return_place_deuce_forehand_dist'] = return_place(player1, events, "Deuce", "Forehand")
    json_data['return_place_ad_forehand'], json_data['return_place_ad_forehand_dist'] = return_place(player1, events, "Ad", "Forehand")
    json_data['return_place_deuce_backhand'], json_data['return_place_deuce_backhand_dist'] = return_place(player1, events, "Deuce", "Backhand")
    json_data['return_place_ad_backhand'], json_data['return_place_ad_backhand_dist'] = return_place(player1, events, "Ad", "Backhand")
    json_data['serve_dist'] = serve_dist(player1, events)
    json_data['serve_error'], json_data['serve_error_dist'] = serve_error_dist(player1, events)
    json_data['serve_place'], json_data['serve_place_labels'] = serve_place(player1, events)
    json_data['summary_stats'] = summary_stats(player1, player2, events)
    json_data['winners'] = winner_place(player1, events)
    json_data['match_summary'] = match_summary(player1, player2, events)
    json_data['slice_place_forehand'] = slice_place(player1, events, "Forehand")
    json_data['slice_place_backhand'] = slice_place(player1, events, "Backhand")
    
    print("Data processing complete!")
    
    # Get script directory to find JS files
    script_dir = Path(__file__).parent
    visuals_dir = script_dir / 'visuals' / 'compilation'
    
    # Load CSS
    css_path = visuals_dir / 'style.css'
    css_content = ""
    if css_path.exists():
        with open(css_path, 'r', encoding='utf-8') as f:
            css_content = f.read()
    else:
        print(f"Warning: Could not find CSS file at {css_path}")
    
    # Load JavaScript files
    js_files = {
        'sum-stats.js': visuals_dir / 'sum-stats.js',
        'winners.js': visuals_dir / 'winners.js',
        'serve-place.js': visuals_dir / 'serve-place.js',
        'serve-error.js': visuals_dir / 'serve-error.js',
        'serve-dist-map.js': visuals_dir / 'serve-dist-map.js',
        'net-errors.js': visuals_dir / 'net-errors.js',
        'return-place.js': visuals_dir / 'return-place.js',
        'ret-cont.js': visuals_dir / 'ret-cont.js',
        'slice-place.js': visuals_dir / 'slice-place.js',
        'header.js': visuals_dir / 'header.js',
        'pdf.js': visuals_dir / 'pdf.js',
        'export_report.js': visuals_dir / 'export_report.js',
    }
    
    js_contents = {}
    for name, path in js_files.items():
        if path.exists():
            js_contents[name] = load_js_file(path)
        else:
            print(f"Warning: Could not find {name} at {path}")
            js_contents[name] = ""
    
    # Replace JSON calls in JavaScript
    print("Embedding data into JavaScript...")
    
    # Create a mapping of JSON filenames to data
    json_data_map = {
        'match_summary.json': json_data['match_summary'],
        'summary_stats.json': json_data['summary_stats'],
        'winners.json': json_data['winners'],
        'serve_place.json': json_data['serve_place'],
        'serve_place_labels.json': json_data['serve_place_labels'],
        'serve_error.json': json_data['serve_error'],
        'serve_error_dist.json': json_data['serve_error_dist'],
        'serve_dist.json': json_data['serve_dist'],
        'net_errors.json': json_data['net_errors'],
        'ret_contact.json': json_data['ret_contact'],
        'ret_contact_dist.json': json_data['ret_contact_dist'],
        'return_place_ad_forehand.json': json_data['return_place_ad_forehand'],
        'return_place_ad_forehand_dist.json': json_data['return_place_ad_forehand_dist'],
        'return_place_ad_backhand.json': json_data['return_place_ad_backhand'],
        'return_place_ad_backhand_dist.json': json_data['return_place_ad_backhand_dist'],
        'return_place_deuce_backhand.json': json_data['return_place_deuce_backhand'],
        'return_place_deuce_backhand_dist.json': json_data['return_place_deuce_backhand_dist'],
        'return_place_deuce_forehand.json': json_data['return_place_deuce_forehand'],
        'return_place_deuce_forehand_dist.json': json_data['return_place_deuce_forehand_dist'],
        'slice_place_forehand.json': json_data['slice_place_forehand'],
        'slice_place_backhand.json': json_data['slice_place_backhand'],
    }
    
    for name in js_contents:
        js_contents[name] = replace_json_calls(js_contents[name], json_data_map)
    
    # Modify drawReturnPlace and drawSlicePlace to handle data objects
    load_data_helper = """const loadData = (source) => {
            if (typeof source === 'string') {
                return d3.json(source);
            } else {
                return Promise.resolve(source);
            }
        };"""
    
    # Modify return-place.js
    if 'return-place.js' in js_contents:
        return_place_code = js_contents['return-place.js']
        return_place_code = return_place_code.replace(
            'function drawReturnPlace(data_location, data_dist_location, svgSelector = "#return-place svg") {',
            'function drawReturnPlace(data_location, data_dist_location, svgSelector = "#return-place svg") {\n        ' + load_data_helper + '\n'
        )
        return_place_code = return_place_code.replace('d3.json(data_location)', 'loadData(data_location)')
        return_place_code = return_place_code.replace('d3.json(data_dist_location)', 'loadData(data_dist_location)')
        js_contents['return-place.js'] = return_place_code
    
    # Modify slice-place.js
    if 'slice-place.js' in js_contents:
        slice_place_code = js_contents['slice-place.js']
        slice_place_code = slice_place_code.replace(
            'function drawSlicePlace(data_location, svgSelector = "#slice-place svg") {',
            'function drawSlicePlace(data_location, svgSelector = "#slice-place svg") {\n        ' + load_data_helper + '\n'
        )
        slice_place_code = slice_place_code.replace('d3.json(data_location)', 'loadData(data_location)')
        js_contents['slice-place.js'] = slice_place_code
    
    # Create inline data script for match summary (used by pdf.js and export_report.js)
    inline_data_script = f"""
    <script>
    // Inline data for match summary (used by pdf.js and export_report.js)
    const matchSummaryData = {json.dumps(json_data['match_summary'], default=str)};
    
    // Override fetch for match_summary.json
    const originalFetch = window.fetch;
    window.fetch = function(...args) {{
        if (args[0] && args[0].includes('match_summary.json')) {{
            return Promise.resolve({{
                json: () => Promise.resolve(matchSummaryData)
            }});
        }}
        return originalFetch.apply(this, args);
    }};
    </script>
    """
    
    # Generate HTML
    print("Generating HTML...")
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Match Visualizations</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap" rel="stylesheet">
    <style>
{css_content}
    </style>
</head>
<body>
    <nav id="toc">
        <ul>
            <li><a href="#sum-stats">Summary Stats</a></li>
            <li><a href="#winner-placement">Winner Placement</a></li>
            <li><a href="#serve-place">Serve Placement</a></li>
            <li><a href="#serve-error">Serve Error</a></li>
            <li><a href="#serve-dist-map">Serve Distribution</a></li>
            <li><a href="#net-errors">Net Errors</a></li>
            <li><a href="#ret-cont">Return Contact</a></li>
            <li><a href="#return-place-ad-forehand">Return Placement</a></li>
            <li><a href="#slice-place-forehand">Slice Placement</a></li>
        </ul>
    </nav>

    <section id="header">
        <div class="match-header">
            <div class="players">
            <span id="player1" class="player"></span>
            <span class="vs">vs</span>
            <span id="player2" class="player"></span>
            </div>

            <div class="set-scores" id="setScores"></div>

            <div class="event-info">
            <span id="eventName"></span> • <span id="eventDate"></span>
            </div>
        </div>
    </section>

    <section id="sum-stats">
        <svg width="1000" height="1000"></svg>
    </section>

    <section id="winner-placement">
        <svg width="1000" height="800"></svg>
    </section>

    <section id="serve-place">
        <svg width="1000" height="800"></svg>
    </section>

    <section id="serve-error">
        <svg width="1000" height="800"></svg>
    </section>

    <section id="serve-dist-map">
        <svg width="1000" height="800"></svg>
    </section>

    <section id="net-errors">
        <svg width="1000" height="800"></svg>
    </section>

    <section id="ret-cont">
        <svg width="1000" height="800"></svg>
    </section>

    <section id="return-place-ad-forehand">
        <svg width="1000" height="800"></svg>
    </section>

    <section id="return-place-ad-backhand">
        <svg width="1000" height="800"></svg>
    </section>

    <section id="return-place-deuce-backhand">
        <svg width="1000" height="800"></svg>
    </section>

    <section id="return-place-deuce-forehand">
        <svg width="1000" height="800"></svg>
    </section>

    <section id="slice-place-forehand">
        <svg width="1000" height="800"></svg>
    </section>

    <section id="slice-place-backhand">
        <svg width="1000" height="800"></svg>
    </section>

    <button id="save-all-sections">Export as PDF</button> 
    <button id="export-report">Download Match Report</button>

{inline_data_script}

    <script>
    {js_contents['sum-stats.js']}
    </script>
    
    <script>
    {js_contents['winners.js']}
    </script>
    
    <script>
    {js_contents['serve-place.js']}
    </script>
    
    <script>
    {js_contents['serve-error.js']}
    </script>
    
    <script>
    {js_contents['serve-dist-map.js']}
    </script>
    
    <script>
    {js_contents['net-errors.js']}
    </script>
    
    <script>
    {js_contents['return-place.js']}
    </script>
    
    <script>
    // Return placement visualizations
    const ad_forehand_data = {json.dumps(json_data['return_place_ad_forehand'], default=str)};
    const ad_forehand_dist_data = {json.dumps(json_data['return_place_ad_forehand_dist'], default=str)};
    drawReturnPlace(ad_forehand_data, ad_forehand_dist_data, "#return-place-ad-forehand svg");

    const ad_backhand_data = {json.dumps(json_data['return_place_ad_backhand'], default=str)};
    const ad_backhand_dist_data = {json.dumps(json_data['return_place_ad_backhand_dist'], default=str)};
    drawReturnPlace(ad_backhand_data, ad_backhand_dist_data, "#return-place-ad-backhand svg");

    const deuce_backhand_data = {json.dumps(json_data['return_place_deuce_backhand'], default=str)};
    const deuce_backhand_dist_data = {json.dumps(json_data['return_place_deuce_backhand_dist'], default=str)};
    drawReturnPlace(deuce_backhand_data, deuce_backhand_dist_data, "#return-place-deuce-backhand svg");

    const deuce_forehand_data = {json.dumps(json_data['return_place_deuce_forehand'], default=str)};
    const deuce_forehand_dist_data = {json.dumps(json_data['return_place_deuce_forehand_dist'], default=str)};
    drawReturnPlace(deuce_forehand_data, deuce_forehand_dist_data, "#return-place-deuce-forehand svg");
    </script>
    
    <script>
    {js_contents['ret-cont.js']}
    </script>

    <script>
    {js_contents['slice-place.js']}
    </script>
    
    <script>
    // Slice placement visualizations
    const forehand_slice_data = {json.dumps(json_data['slice_place_forehand'], default=str)};
    drawSlicePlace(forehand_slice_data, "#slice-place-forehand svg");

    const backhand_slice_data = {json.dumps(json_data['slice_place_backhand'], default=str)};
    drawSlicePlace(backhand_slice_data, "#slice-place-backhand svg");
    </script>

    <script>
    {js_contents['header.js']}
    </script>

    <script>
    {js_contents['export_report.js']}
    </script>

    <!-- Libraries for PDF saving -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script>
    {js_contents['pdf.js']}
    </script>

</body>
</html>"""
    
    # Write HTML file
    if output_path is None:
        output_path = f"{player1.replace(' ', '_')}_vs_{player2.replace(' ', '_')}_visualizations.html"
    
    print(f"Writing HTML to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"✓ Successfully generated {output_path}")
    return output_path


# ============================================================================
# MAIN FUNCTION
# ============================================================================

def main():
    """Main entry point"""
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)
    
    csv_path = sys.argv[1]
    player1 = sys.argv[2]
    player2 = sys.argv[3]
    output_path = sys.argv[4] if len(sys.argv) > 4 else None
    
    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found: {csv_path}")
        sys.exit(1)
    
    try:
        generate_html(csv_path, player1, player2, output_path)
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
